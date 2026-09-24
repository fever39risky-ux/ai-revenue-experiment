import unittest
from clean import preview

class PreviewTests(unittest.TestCase):
    def test_identifiers_quotes_and_normalization(self):
        r=preview('record_id,label,status\n001,"  item, A  ", OPEN \n')
        self.assertEqual(r['accepted'],[{'record_id':'001','label':'item, A','status':'open'}])
    def test_rejections_are_accounted_for(self):
        r=preview('record_id,label,status\n001,A,open\n001,B,closed\n002,C,maybe\n003,=1+1,open\n004,too,many,fields\n')
        self.assertEqual([x['reason'] for x in r['issues']],['duplicate_id','unknown_status','spreadsheet_formula_prefix','column_count'])
        self.assertEqual(r['input_rows'],len(r['accepted'])+len(r['issues']))
    def test_header_fail_closed(self):
        with self.assertRaises(ValueError): preview('id,label,status\n1,a,open\n')
    def test_whitespace_id_not_silently_changed(self):
        self.assertEqual(preview('record_id,label,status\n 001,a,open\n')['issues'][0]['reason'],'invalid_id')
    def test_bad_quoting(self):
        with self.assertRaises(Exception): preview('record_id,label,status\n001,"unclosed,open')

if __name__ == '__main__': unittest.main()
