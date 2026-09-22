import importlib.util
import json
from pathlib import Path
import signal
import subprocess as sp
import sys
import tempfile
import time
import unittest

SCRIPT = Path(__file__).resolve().parents[1]/'scripts/autonomy_supervisor.py'
spec = importlib.util.spec_from_file_location('supervisor',SCRIPT)
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

class SupervisorTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.r=Path(self.tmp.name)
        for d in ('status','.autonomy'): (self.r/d).mkdir()
        (self.r/'.autonomy-test-repo').touch()
        self.s=dict(goal_achieved=False,human_blocked=False,ai_operable_work_remaining=True,
                    goal_revenue_jpy=1,stop_reason=None,next_action='resume proof',consecutive_failures=0)
        self.l=dict(official_entries=[],totals=dict(official_revenue_jpy_equivalent=0))
        self.cfg=dict(command=[sys.executable,'-c','print("OK")'],max_runs=2)
        self.save()
    def tearDown(self): self.tmp.cleanup()
    def save(self):
        for p,v in [('status/AUTONOMY_STATE.json',self.s),('status/revenue_ledger.json',self.l),('.autonomy/test.json',self.cfg)]:
            (self.r/p).write_text(json.dumps(v))
    def launch(self):
        return sp.Popen([sys.executable,str(SCRIPT),'run','--repo',str(self.r),'--test'],stdout=sp.DEVNULL,stderr=sp.DEVNULL)
    def run_it(self):
        self.save(); p=self.launch(); self.assertEqual(p.wait(timeout=12),0)
        return [json.loads(x) for x in (self.r/'logs/supervisor.log').read_text().splitlines()]
    def count(self,rows,event): return sum(x['event']==event for x in rows)
    def wait_running(self):
        for _ in range(100):
            try:
                d=json.loads((self.r/'.autonomy/runtime.json').read_text())
                if d['phase']=='running': return d
            except (OSError,ValueError): pass
            time.sleep(.03)
        self.fail('did not start')
    def test_normal_restarts(self): self.assertEqual(self.count(self.run_it(),'claude_start'),2)
    def test_abnormal_retries(self):
        self.cfg['command']=[sys.executable,'-c','import sys; sys.exit(7)']
        rows=self.run_it(); self.assertEqual(self.count(rows,'claude_start'),2)
        self.assertTrue(all(x['exit_code']==7 for x in rows if x['event']=='claude_end'))
        self.assertEqual(self.count(rows,'backoff'),2)
    def test_verified_goal_stops(self):
        self.s['goal_achieved']=True
        self.l['official_entries']=[dict(jpy_equivalent=1,verified=True,third_party=True,is_test=False,reference='fixture',period='official')]
        self.l['totals']['official_revenue_jpy_equivalent']=1
        self.assertEqual(self.count(self.run_it(),'claude_start'),0)
    def test_unverified_goal_cannot_stop(self):
        self.s['goal_achieved']=True
        self.assertEqual(self.count(self.run_it(),'claude_start'),2)
    def test_human_only_stops(self):
        self.s.update(human_blocked=True,ai_operable_work_remaining=False,human_blocker_evidence={'step':'fixture','alternatives':['a','b','c']})
        self.assertEqual(self.count(self.run_it(),'claude_start'),0)
    def test_human_blocked_other_work_continues(self):
        self.s['human_blocked']=True
        self.assertEqual(self.count(self.run_it(),'claude_start'),2)
    def test_invalid_json_stops(self):
        (self.r/'status/AUTONOMY_STATE.json').write_text('{broken')
        p=self.launch(); self.assertEqual(p.wait(timeout=5),0)
        self.assertIn('invalid_state_or_ledger',(self.r/'logs/supervisor.log').read_text())
    def test_wrong_boolean_stops(self):
        self.s['goal_achieved']='false'
        self.assertEqual(self.count(self.run_it(),'claude_start'),0)
    def test_git_failure_backoff_preserves_state(self):
        self.cfg['sync']='fetch_failed'; self.save()
        before=(self.r/'status/AUTONOMY_STATE.json').read_bytes()
        rows=self.run_it()
        self.assertEqual(self.count(rows,'backoff'),1)
        self.assertEqual(before,(self.r/'status/AUTONOMY_STATE.json').read_bytes())
    def test_duplicate_and_killed_claude_recovery(self):
        # First mock Claude deliberately sleeps; next invocation exits immediately.
        code="import pathlib,time; p=pathlib.Path('once'); first=not p.exists(); p.touch(); time.sleep(30 if first else 0)"
        self.cfg['command']=[sys.executable,'-c',code]; self.save()
        p=self.launch()
        try:
            state=self.wait_running(); q=self.launch(); self.assertEqual(q.wait(timeout=5),75)
            child=None
            for _ in range(100):
                out=sp.check_output(['/bin/ps','-axo','pid,ppid'],text=True)
                kids=[int(x.split()[0]) for x in out.splitlines()[1:] if int(x.split()[1])==state['worker_pid']]
                if kids and (self.r/'once').exists(): child=kids[0]; break
                time.sleep(.03)
            self.assertIsNotNone(child)
            import os; os.kill(child,signal.SIGKILL)
            self.assertEqual(p.wait(timeout=8),0)
            rows=[json.loads(x) for x in (self.r/'logs/supervisor.log').read_text().splitlines()]
            self.assertEqual(self.count(rows,'claude_start'),2)
            self.assertIn(-9,[x['exit_code'] for x in rows if x['event']=='claude_end'])
        finally:
            if p.poll() is None: p.terminate(); p.wait(timeout=15)
    def test_parent_crash_keeps_child_lock(self):
        self.cfg['command']=[sys.executable,'-c','import time; time.sleep(3)']; self.save()
        p=self.launch(); state=self.wait_running(); p.kill(); p.wait(timeout=5)
        q=self.launch(); self.assertEqual(q.wait(timeout=5),75)
        # Worker must outlive parent and release lock only after its child finishes.
        time.sleep(3.5)
        self.cfg['command']=[sys.executable,'-c','print("recovered")']; self.cfg['max_runs']=1; self.save()
        q=self.launch(); self.assertEqual(q.wait(timeout=5),0)

    def test_rate_limit_and_no_secret_logs(self):
        secret='fixture_sensitive_'+'123456789'
        self.cfg['command']=[sys.executable,'-c',f'import sys; print("rate limit {secret}"); print("person@example.invalid",file=sys.stderr); sys.exit(1)']
        rows=self.run_it()
        self.assertTrue(any(x.get('kind')=='rate_limit' and x.get('seconds',0)>=900 for x in rows))
        for p in (self.r/'logs').rglob('*'):
            if p.is_file():
                self.assertNotIn(secret,p.read_text()); self.assertNotIn('person@example.invalid',p.read_text())
    def test_hard_stop(self):
        self.s['stop_reason']='permission'; self.assertEqual(self.count(self.run_it(),'claude_start'),0)
    def test_actual_git_ff_and_conflict_preservation(self):
        # Exercise real local git implementation without any production/network mutation.
        remote=self.r/'remote.git'; checkout=self.r/'checkout'; other=self.r/'other'
        def git(cwd,*args): return sp.run(['/usr/bin/git',*args],cwd=cwd,check=True,capture_output=True)
        git(self.r,'init','--bare',str(remote)); git(self.r,'clone',str(remote),str(checkout))
        for d in [checkout]:
            git(d,'config','user.email','fixture@example.invalid'); git(d,'config','user.name','Fixture'); git(d,'checkout','-b','main')
        (checkout/'file').write_text('one'); git(checkout,'add','file'); git(checkout,'commit','-m','one'); git(checkout,'push','origin','main')
        git(self.r,'clone','-b','main',str(remote),str(other))
        git(other,'config','user.email','fixture@example.invalid'); git(other,'config','user.name','Fixture')
        (other/'file').write_text('two'); git(other,'commit','-am','two'); git(other,'push','origin','main')
        old=m.REMOTE; m.REMOTE=str(remote)
        try:
            r=m.Runner(checkout); self.assertEqual(r.sync(),'synced'); self.assertEqual((checkout/'file').read_text(),'two')
            (checkout/'file').write_text('unfinished'); self.assertEqual(r.sync(),'recovery_required')
            self.assertEqual((checkout/'file').read_text(),'unfinished')
        finally: m.REMOTE=old

if __name__=='__main__': unittest.main(verbosity=2)
