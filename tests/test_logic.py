import unittest
from orbit_warden.logic import Circle,collides,State,difficulty
class Tests(unittest.TestCase):
 def test_collision(self):
  self.assertTrue(collides(Circle(0,0,10),Circle(20,0,10)))
  self.assertFalse(collides(Circle(0,0,10),Circle(21,0,10)))
 def test_game_over(self):
  s=State(hp=1);s.damage();self.assertTrue(s.over);self.assertEqual(s.hp,0);s.award('drone');self.assertEqual(s.score,0)
 def test_hp_floor(self):
  s=State();s.damage(99);self.assertEqual(s.hp,0)
 def test_difficulty(self):
  self.assertEqual(difficulty(0),1);self.assertEqual(difficulty(10000),3.5)
