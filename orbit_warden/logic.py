from dataclasses import dataclass

WIDTH, HEIGHT = 960, 640

@dataclass
class Circle:
    x: float
    y: float
    radius: float

def collides(a, b):
    return (a.x-b.x)**2+(a.y-b.y)**2 <= (a.radius+b.radius)**2

def difficulty(t):
    return min(3.5, 1+max(t,0)/45)

POINTS={'asteroid':10,'drone':25,'zigzag':35,'tank':50}

@dataclass
class State:
    hp: int=5
    score: int=0
    time: float=0
    energy: float=100
    shield: float=100
    over: bool=False
    def damage(self, amount=1):
        if not self.over:
            self.hp=max(0,self.hp-amount)
            self.over=self.hp==0
    def award(self,kind):
        if not self.over:
            self.score+=POINTS[kind]
