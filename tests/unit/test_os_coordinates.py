import importlib.util, pathlib, unittest
spec = importlib.util.spec_from_file_location('os_coordinates', pathlib.Path(__file__).parents[2] / 'scripts/property/os_coordinates.py')
os = importlib.util.module_from_spec(spec)
spec.loader.exec_module(os)
class Coordinates(unittest.TestCase):
    def test_deduplication_conflict_and_coordinate_order(self):
        row = ['123','470000','173000','51.45','-0.97']
        other = ['456','470000','173000','51.46','-0.96']
        result = os.join_rows(iter([row,row,other,other[:-1]+['-0.98']]), {'123','456'})
        self.assertEqual(result['coordinates'], [{'uprn':'123','position':[-0.97,51.45]}])
        self.assertEqual(result['ambiguousUprns'], ['456'])
        self.assertEqual(result['duplicateRows'], 1)
    def test_validates_all_rows_even_unrequested(self):
        for row in [ ['123','470000','173000','nan','-0.97'], ['123','470000','173000','-0.97','51.45'], ['123','470000','173000','99','0'], ['0','470000','173000','51.45','-0.97'], ['123','470000'], ['123','inf','173000','51.45','-0.97'] ]:
            with self.subTest(row=row), self.assertRaises(ValueError): os.join_rows(iter([row]),set())
if __name__ == '__main__': unittest.main()
