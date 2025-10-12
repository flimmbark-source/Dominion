# File: grimm_dominion_vertical_slice.py
"""
Grimm Dominion – Pygame vertical slice (Codespaces-friendly).
Run native:   python grimm_dominion_vertical_slice.py
Run fast:     python grimm_dominion_vertical_slice.py --fast --no-debug
Headless CI:  GD_HEADLESS=1 python grimm_dominion_vertical_slice.py --headless --tick-seconds 2
Web preview:  make web   (uses pygbag; open forwarded port)
"""
import argparse
import math
import os
import random
import sys
from dataclasses import dataclass
from typing import Callable, List, Optional, Tuple

# ------------------- CLI & Headless-safe Pygame init ------------------- #
def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--width", type=int, default=960)
    p.add_argument("--height", type=int, default=640)
    p.add_argument("--fast", action="store_true", help="Faster boot: fewer NPCs")
    p.add_argument("--no-debug", action="store_true", help="Disable vision debug")
    p.add_argument("--headless", action="store_true", help="Use SDL dummy driver (CI/tests)")
    p.add_argument("--tick-seconds", type=float, default=0.0, help="Auto-exit after N seconds (CI)")
    return p.parse_args()

ARGS = parse_args()

# Headless mode: dummy driver (Codespaces CI/tests). Not for actual play.
if ARGS.headless or os.environ.get("GD_HEADLESS") == "1":
    os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
    os.environ.setdefault("SDL_AUDIODRIVER", "dummy")

# Pygbag: allow running in browser (Codespaces preview). No special env needed.

import pygame  # noqa E402

WIDTH, HEIGHT = ARGS.width, ARGS.height
FPS = 60
HUD_HEIGHT = 120
VILLAGE_BOUNDS = pygame.Rect(40, 40, WIDTH - 80, HEIGHT - 160)

# Detection tuning
DETECTION_FILL_RATE = 0.7
DETECTION_DECAY_RATE = 0.35
NOISE_RADIUS_SPRINT = 120
NOISE_SPRINT_POWER = 0.35
NOISE_CHEST_POWER = 0.55

# Threat tuning
THREAT_LOOT_DELTA = 7
THREAT_SPOTTED_DELTA = 25
THREAT_SPAWN_THRESHOLDS = [50, 100, 160]
THREAT_MAX_EXTRA_SCOUTS = 3

# Colors
C_BG = (14, 18, 28)
C_DARK = (8, 10, 16)
C_PANEL = (25, 25, 35)
C_PANEL_BORDER = (80, 80, 110)
C_WHITE = (240, 240, 240)
C_GOLD = (240, 200, 40)
C_HEALTH = (60, 200, 90)
C_DETECT = (60, 140, 220)
C_HOUSE = (70, 60, 50)
C_HOUSE_BORDER = (40, 35, 30)
C_GOBLIN = (80, 200, 80)
C_VILLAGER = (200, 200, 200)
C_SCOUT = (220, 120, 120)
C_TORCH = (240, 210, 120)
C_CHEST = (180, 140, 60)
C_CHEST_OPEN = (90, 75, 35)
C_TAVERN = (50, 110, 60)
C_CASTLE = (60, 50, 80)
C_SHOP_BG = (20, 22, 30)
C_SHOP_ACCENT = (170, 150, 90)

pygame.init()

# In headless/CI, build a tiny hidden surface so init doesn't stall.
flags = 0
if os.environ.get("SDL_VIDEODRIVER") == "dummy":
    flags |= pygame.HIDDEN

screen = pygame.display.set_mode((WIDTH, HEIGHT), flags)
pygame.display.set_caption("Grimm Dominion – Vertical Slice")
clock = pygame.time.Clock()

# Fonts: SysFont can be slow on first run; cache created fonts into module globals.
def _font_cached(name: str, size: int, bold: bool = False):
    key = (name, size, bold)
    if key not in _font_cached.cache:
        _font_cached.cache[key] = pygame.font.SysFont(name, size, bold=bold)
    return _font_cached.cache[key]
_font_cached.cache = {}
FONT = _font_cached("verdana", 16)
FONT_SMALL = _font_cached("verdana", 12)
FONT_TITLE = _font_cached("georgia", 22, True)

# ---------------------------- Utility ---------------------------- #

def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))

def vec_from_angle(angle_rad: float) -> pygame.Vector2:
    return pygame.Vector2(math.cos(angle_rad), math.sin(angle_rad))

def line_intersects_rect(p1: Tuple[float, float], p2: Tuple[float, float], rect: pygame.Rect) -> bool:
    return rect.clipline(p1, p2)

def draw_bar(surface, rect: pygame.Rect, frac: float, fg_color, bg_color=(30, 30, 40), border=(80, 80, 110)):
    pygame.draw.rect(surface, bg_color, rect, border_radius=4)
    inner = rect.inflate(-4, -4)
    fill = inner.copy()
    fill.width = max(0, int(inner.width * clamp(frac, 0, 1)))
    pygame.draw.rect(surface, fg_color, fill, border_radius=4)
    pygame.draw.rect(surface, border, rect, 1, border_radius=4)

# ---------------------------- Data / Items / Inventory ---------------------------- #

@dataclass
class Stats:
    health: int = 100
    base_speed: float = 120.0
    sprint_mult: float = 1.8
    attack: int = 10
    stealth_resist: float = 0.0
    invis_timer: float = 0.0
    def speed(self) -> float: return self.base_speed

class Item:
    def __init__(
        self, id: str, name: str, price: int, desc: str,
        apply_fn: Optional[Callable[['Stats'], None]] = None,
        remove_fn: Optional[Callable[['Stats'], None]] = None,
        consumable: bool = False,
        use_fn: Optional[Callable[['Stats'], None]] = None,
        short: str = "?"
    ):
        self.id=id; self.name=name; self.price=price; self.desc=desc
        self.apply_fn=apply_fn; self.remove_fn=remove_fn
        self.consumable=consumable; self.use_fn=use_fn; self.short=short
    def apply(self, s:'Stats'): 
        if self.apply_fn: self.apply_fn(s)
    def remove(self, s:'Stats'):
        if self.remove_fn: self.remove_fn(s)
    def use(self, s:'Stats'):
        if self.consumable and self.use_fn: self.use_fn(s)

class Inventory:
    def __init__(self, capacity: int = 6):
        self.capacity = capacity
        self.slots: List[Optional[Item]] = [None]*capacity
    def add(self, item: Item) -> bool:
        for i in range(self.capacity):
            if self.slots[i] is None:
                self.slots[i] = item; return True
        return False
    def remove_slot(self, idx: int) -> Optional[Item]:
        if 0 <= idx < self.capacity:
            it = self.slots[idx]; self.slots[idx]=None; return it
        return None
    def use_slot(self, idx: int, stats: Stats) -> bool:
        if 0 <= idx < self.capacity and self.slots[idx]:
            it = self.slots[idx]
            if it.consumable:
                it.use(stats); self.slots[idx]=None; return True
            return False
        return False

# ---------------------------- Entities ---------------------------- #

class Entity:
    def __init__(self, x: float, y: float, w: int, h: int):
        self.pos = pygame.Vector2(x, y)
        self.rect = pygame.Rect(0, 0, w, h)
        self.update_rect()
    def update_rect(self): self.rect.center = (int(self.pos.x), int(self.pos.y))
    def draw(self, surface): ...

class Goblin(Entity):
    def __init__(self, x, y):
        super().__init__(x, y, 20, 20)
        self.stats = Stats()
        self.gold = 0
        self.inventory = Inventory()
        self.facing = 0.0
        self.sprinting = False
        self.in_tavern = False
    def update(self, dt: float, houses: List[pygame.Rect]):
        keys = pygame.key.get_pressed()
        move = pygame.Vector2(0, 0)
        if keys[pygame.K_w] or keys[pygame.K_UP]: move.y -= 1
        if keys[pygame.K_s] or keys[pygame.K_DOWN]: move.y += 1
        if keys[pygame.K_a] or keys[pygame.K_LEFT]: move.x -= 1
        if keys[pygame.K_d] or keys[pygame.K_RIGHT]: move.x += 1
        self.sprinting = keys[pygame.K_LSHIFT] or keys[pygame.K_RSHIFT]
        speed = self.stats.speed() * (self.stats.sprint_mult if self.sprinting else 1.0)
        if move.length_squared() > 0:
            move = move.normalize()
            self.facing = math.atan2(move.y, move.x)
        delta = move * speed * dt
        # Axis-separated movement with collision
        new_pos = self.pos + pygame.Vector2(delta.x, 0)
        trial = self.rect.copy(); trial.centerx = int(new_pos.x)
        if VILLAGE_BOUNDS.contains(trial) and not any(trial.colliderect(h) for h in houses): self.pos.x = new_pos.x
        new_pos = self.pos + pygame.Vector2(0, delta.y)
        trial = self.rect.copy(); trial.centery = int(new_pos.y)
        if VILLAGE_BOUNDS.contains(trial) and not any(trial.colliderect(h) for h in houses): self.pos.y = new_pos.y
        self.update_rect()
        if self.stats.invis_timer > 0: self.stats.invis_timer = max(0.0, self.stats.invis_timer - dt)
    def draw(self, surface):
        color = C_GOBLIN if self.stats.invis_timer <= 0 else (120, 180, 140)
        pygame.draw.rect(surface, color, self.rect, border_radius=4)
        eye = pygame.Vector2(self.rect.center) + vec_from_angle(self.facing) * 10
        pygame.draw.circle(surface, (0,0,0), eye, 2)

class NPC(Entity):
    def __init__(self, x, y, w, h, fov_deg: float, view_distance: float, color, detect_power: float):
        super().__init__(x, y, w, h)
        self.facing = 0.0
        self.fov = math.radians(fov_deg)
        self.view_distance = view_distance
        self.color = color
        self.detect_power = detect_power
        self.vision_debug = False
    def sees(self, target: Goblin, houses: List[pygame.Rect]) -> bool:
        if target.stats.invis_timer > 0: return False
        to_t = pygame.Vector2(target.rect.center) - pygame.Vector2(self.rect.center)
        dist = to_t.length()
        if dist > self.view_distance or dist <= 1e-4: return False
        ang = math.atan2(to_t.y, to_t.x)
        dtheta = (ang - self.facing + math.pi) % (2*math.pi) - math.pi
        if abs(dtheta) > self.fov * 0.5: return False
        p1 = self.rect.center; p2 = target.rect.center
        for h in houses:
            if line_intersects_rect(p1, p2, h): return False
        return True
    def draw_fov(self, surface):
        if not self.vision_debug: return
        origin = pygame.Vector2(self.rect.center)
        left = self.facing - self.fov * 0.5
        right = self.facing + self.fov * 0.5
        p1 = origin + vec_from_angle(left) * self.view_distance
        p2 = origin + vec_from_angle(right) * self.view_distance
        pygame.draw.polygon(surface, (255,255,255), [origin, p1, p2], width=1)
    def draw(self, surface):
        pygame.draw.rect(surface, self.color, self.rect, border_radius=3)
        self.draw_fov(surface)

class Villager(NPC):
    def __init__(self, x, y, roam_rect: pygame.Rect):
        super().__init__(x, y, 18, 18, fov_deg=70, view_distance=140, color=C_VILLAGER, detect_power=0.55)
        self.roam_rect = roam_rect
        self.target = pygame.Vector2(random.randint(roam_rect.left, roam_rect.right),
                                     random.randint(roam_rect.top, roam_rect.bottom))
        self.speed = 60.0
    def update(self, dt: float, houses: List[pygame.Rect]):
        d = self.target - self.pos
        if d.length() < 6:
            self.target = pygame.Vector2(random.randint(self.roam_rect.left, self.roam_rect.right),
                                         random.randint(self.roam_rect.top, self.roam_rect.bottom))
        else:
            v = d.normalize() * self.speed * dt
            new_pos = self.pos + v
            trial = self.rect.copy(); trial.center = (int(new_pos.x), int(new_pos.y))
            if VILLAGE_BOUNDS.contains(trial) and not any(trial.colliderect(h) for h in houses): self.pos = new_pos
            self.facing = math.atan2(v.y, v.x)
        self.update_rect()

class Scout(NPC):
    def __init__(self, waypoints: List[Tuple[int, int]], speed: float = 90.0):
        x, y = waypoints[0]
        super().__init__(x, y, 18, 18, fov_deg=95, view_distance=200, color=C_SCOUT, detect_power=1.0)
        self.waypoints = [pygame.Vector2(p) for p in waypoints]
        self.idx = 0; self.speed = speed; self.forward = True
    def update(self, dt: float, houses: List[pygame.Rect]):
        target = self.waypoints[self.idx]
        d = target - self.pos
        if d.length() < 8:
            if self.forward:
                self.idx += 1
                if self.idx >= len(self.waypoints): self.idx = len(self.waypoints)-2; self.forward = False
            else:
                self.idx -= 1
                if self.idx < 0: self.idx = 1; self.forward = True
        else:
            v = d.normalize() * self.speed * dt
            new_pos = self.pos + v
            trial = self.rect.copy(); trial.center = (int(new_pos.x), int(new_pos.y))
            if VILLAGE_BOUNDS.contains(trial) and not any(trial.colliderect(h) for h in houses): self.pos = new_pos
            self.facing = math.atan2(v.y, v.x)
        self.update_rect()

# ---------------------------- Environment ---------------------------- #

class House:
    def __init__(self, rect: pygame.Rect): self.rect = rect
    def draw(self, surface):
        pygame.draw.rect(surface, C_HOUSE, self.rect, border_radius=4)
        pygame.draw.rect(surface, C_HOUSE_BORDER, self.rect, 2, border_radius=4)

class Chest:
    def __init__(self, rect: pygame.Rect, gold: int = 50):
        self.rect = rect; self.gold = gold; self.opened = False
    def draw(self, surface):
        c = C_CHEST_OPEN if self.opened else C_CHEST
        pygame.draw.rect(surface, c, self.rect, border_radius=3)
        pygame.draw.rect(surface, (30,20,10), self.rect, 1, border_radius=3)
    def try_loot(self, goblin_rect: pygame.Rect) -> Optional[int]:
        if not self.opened and self.rect.colliderect(goblin_rect):
            self.opened = True; return self.gold
        return None

class Tavern:
    def __init__(self, rect: pygame.Rect): self.rect = rect
    def draw(self, surface):
        pygame.draw.rect(surface, C_TAVERN, self.rect, border_radius=6)
        pygame.draw.rect(surface, (30,60,35), self.rect, 2, border_radius=6)

class Castle:
    def __init__(self, rect: pygame.Rect, spawn_point: Tuple[int, int]):
        self.rect = rect; self.spawn_point = spawn_point
    def draw(self, surface):
        pygame.draw.rect(surface, C_CASTLE, self.rect)
        for i in range(self.rect.left, self.rect.right, 14):
            pygame.draw.rect(surface, (40,35,60), (i, self.rect.top-6, 10, 6))

# ---------------------------- Systems ---------------------------- #

class DetectionMeter:
    def __init__(self):
        self.value = 0.0; self.spotted = False
    def reset_spotted(self): self.spotted = False
    def update(self, dt: float, exposure_power: float, resist: float):
        if exposure_power > 0:
            inc = exposure_power * DETECTION_FILL_RATE * dt
            inc *= (1.0 - clamp(resist, 0.0, 0.8))
            self.value = clamp(self.value + inc, 0.0, 1.0)
        else:
            self.value = clamp(self.value - DETECTION_DECAY_RATE * dt, 0.0, 1.0)
        if self.value >= 0.999 and not self.spotted:
            self.spotted = True; print("[ALERT] The goblin has been spotted!")

class ThreatSystem:
    def __init__(self):
        self.value = 0; self.spawned_levels = 0
    def add(self, delta: int): self.value = max(0, self.value + delta)

# ---------------------------- Shop / Items ---------------------------- #

def make_items() -> List[Item]:
    def boots_apply(s: Stats): s.base_speed += 40
    def cloak_apply(s: Stats): s.stealth_resist += 0.25
    def dagger_apply(s: Stats): s.attack += 15
    def potion_use(s: Stats): s.invis_timer = max(s.invis_timer, 6.0)
    return [
        Item("boots", "Boots of Skittering", 100, "Fleet goblin steps. +Speed",
             apply_fn=boots_apply, short="B"),
        Item("cloak", "Cloak of Shadows", 150, "Misty shroud. -Detection rate",
             apply_fn=cloak_apply, short="C"),
        Item("dagger", "Poison Dagger", 120, "Toxic edge. +Attack",
             apply_fn=dagger_apply, short="D"),
        Item("potion", "Invisibility Potion", 80, "Vanish briefly. Use to become unseen",
             consumable=True, use_fn=potion_use, short="P"),
    ]

class Shop:
    def __init__(self, items: List[Item]):
        self.items = items; self.open = False; self.message = ""
    def open_shop(self):
        self.open = True; self.message = "Goblin Merchant: What are ya buyin'?"
    def close_shop(self):
        self.open = False; self.message = ""
    def try_buy(self, idx: int, goblin: 'Goblin'):
        if 0 <= idx < len(self.items):
            item = self.items[idx]
            if goblin.gold >= item.price:
                if item.consumable or goblin.inventory.add(item):
                    goblin.gold -= item.price
                    if not item.consumable: item.apply(goblin.stats)
                    self.message = f"Purchased {item.name}!"; print(self.message)
                else:
                    self.message = "Inventory full!"; print(self.message)
            else:
                self.message = "Not enough gold!"; print(self.message)
    def draw(self, surface):
        panel = pygame.Rect(80, 80, WIDTH - 160, HEIGHT - 200)
        pygame.draw.rect(surface, C_SHOP_BG, panel, border_radius=10)
        pygame.draw.rect(surface, C_SHOP_ACCENT, panel, 2, border_radius=10)
        title = FONT_TITLE.render("Goblin Tavern – Shop", True, C_GOLD)
        surface.blit(title, (panel.x + 16, panel.y + 12))
        y = panel.y + 56
        for i, item in enumerate(self.items):
            line = f"{i+1}. {item.name} ({item.price}g) – {item.desc}"
            surface.blit(FONT.render(line, True, C_WHITE), (panel.x + 16, y))
            y += 28
        hint = FONT_SMALL.render("Press number to buy. [0] or [Esc] to leave.", True, (200,200,220))
        surface.blit(hint, (panel.x + 16, panel.bottom - 40))
        if self.message:
            surface.blit(FONT.render(self.message, True, C_GOLD), (panel.x + 16, panel.bottom - 70))

# ---------------------------- Game ---------------------------- #

class Game:
    def __init__(self, fast: bool, debug_vision: bool):
        self.goblin = Goblin(200, HEIGHT - HUD_HEIGHT - 120)
        self.houses: List[House] = self._build_houses()
        self.houses_rects = [h.rect for h in self.houses]
        self.chests = self._place_chests()
        self.tavern = Tavern(pygame.Rect(WIDTH - 180, HEIGHT - HUD_HEIGHT - 140, 120, 90))
        self.castle = Castle(pygame.Rect(WIDTH // 2 - 60, 20, 120, 60), spawn_point=(WIDTH // 2, 90))
        self.npcs: List[NPC] = []
        self._populate_villagers_and_scouts(fast)
        self.detection = DetectionMeter()
        self.threat = ThreatSystem()
        self.shop = Shop(make_items())
        self.debug_vision = debug_vision

    def _build_houses(self) -> List[House]:
        blocks = [
            pygame.Rect(140, 140, 120, 90),
            pygame.Rect(320, 120, 130, 110),
            pygame.Rect(520, 150, 150, 100),
            pygame.Rect(180, 330, 140, 120),
            pygame.Rect(480, 330, 170, 120),
            pygame.Rect(720, 240, 150, 110),
        ]
        return [House(r) for r in blocks]

    def _place_chests(self) -> List[Chest]:
        spots = [
            pygame.Rect(160, 170, 20, 20),
            pygame.Rect(340, 160, 20, 20),
            pygame.Rect(540, 180, 20, 20),
            pygame.Rect(200, 360, 20, 20),
            pygame.Rect(500, 360, 20, 20),
        ]
        return [Chest(r, gold=random.choice([40, 50, 60, 80])) for r in spots]

    def _populate_villagers_and_scouts(self, fast: bool):
        roam_areas = [
            pygame.Rect(120, 120, 200, 160),
            pygame.Rect(300, 110, 220, 160),
            pygame.Rect(460, 140, 260, 160),
            pygame.Rect(160, 310, 220, 170),
            pygame.Rect(460, 310, 260, 170),
        ]
        villager_count = 2 if fast else 3
        for r in roam_areas[:villager_count]:
            self.npcs.append(Villager(r.centerx, r.centery, r))
        patrol1 = [(80, 260), (300, 260), (560, 260), (860, 260)]
        self.npcs.append(Scout(patrol1))
        if not fast:
            patrol2 = [(120, HEIGHT - HUD_HEIGHT - 200), (860, HEIGHT - HUD_HEIGHT - 200)]
            self.npcs.append(Scout(patrol2, speed=100))

    def _noise_from_sprint(self) -> float:
        if not self.goblin.sprinting: return 0.0
        power = 0.0
        for npc in self.npcs:
            d = pygame.Vector2(npc.rect.center).distance_to(self.goblin.rect.center)
            if d <= NOISE_RADIUS_SPRINT:
                falloff = 1.0 - (d / NOISE_RADIUS_SPRINT)
                power = max(power, NOISE_SPRINT_POWER * falloff)
        return power

    def _noise_from_chest(self):
        print("[NOISE] Chest clatter echoes!")
        self.detection.value = clamp(self.detection.value + NOISE_CHEST_POWER, 0, 1)
        self.threat.add(THREAT_LOOT_DELTA)

    def _exposure_from_sight(self) -> float:
        exposure = 0.0
        for npc in self.npcs:
            npc.vision_debug = self.debug_vision
            if npc.sees(self.goblin, self.houses_rects):
                exposure += npc.detect_power
        return clamp(exposure, 0.0, 3.0)

    def _maybe_spawn_reinforcements(self):
        while self.threat.spawned_levels < min(len(THREAT_SPAWN_THRESHOLDS), THREAT_MAX_EXTRA_SCOUTS):
            need = THREAT_SPAWN_THRESHOLDS[self.threat.spawned_levels]
            if self.threat.value >= need:
                sx, sy = self.castle.spawn_point
                patrol = [(sx, sy), (sx, sy + 60), (sx, 260), (WIDTH - 100, 260)]
                self.npcs.append(Scout(patrol, speed=105 + 5 * self.threat.spawned_levels))
                self.threat.spawned_levels += 1
                print("[THREAT] Reinforcement scout dispatched from the castle!")
            else:
                break

    def handle_events(self):
        for e in pygame.event.get():
            if e.type == pygame.QUIT:
                pygame.quit(); sys.exit(0)
            elif e.type == pygame.KEYDOWN:
                if self.shop.open:
                    if e.key in (pygame.K_ESCAPE, pygame.K_0): self.shop.close_shop()
                    elif pygame.K_1 <= e.key <= pygame.K_9:
                        idx = e.key - pygame.K_1; self.shop.try_buy(idx, self.goblin)
                else:
                    if e.key == pygame.K_v: self.debug_vision = not self.debug_vision
                    if e.key == pygame.K_TAB and self.tavern.rect.colliderect(self.goblin.rect): self.shop.open_shop()
                    if e.key == pygame.K_e:
                        for ch in self.chests:
                            if not ch.opened and ch.rect.colliderect(self.goblin.rect):
                                gold = ch.try_loot(self.goblin.rect)
                                if gold:
                                    self.goblin.gold += gold
                                    print(f"[LOOT] +{gold} gold (Total {self.goblin.gold})")
                                    self._noise_from_chest()
                    if pygame.K_1 <= e.key <= pygame.K_6:
                        idx = e.key - pygame.K_1
                        if self.goblin.inventory.use_slot(idx, self.goblin.stats):
                            print(f"[ITEM] Used slot {idx+1}")

    def update(self, dt: float):
        if self.shop.open: return
        self.goblin.update(dt, self.houses_rects)
        for npc in self.npcs: npc.update(dt, self.houses_rects)
        sight = self._exposure_from_sight()
        noise = self._noise_from_sprint()
        exposure_power = clamp(sight + noise, 0.0, 2.0)
        self.detection.update(dt, exposure_power, self.goblin.stats.stealth_resist)
        if self.detection.spotted:
            self.threat.add(THREAT_SPOTTED_DELTA)
            self.detection.reset_spotted()
        self.goblin.in_tavern = self.tavern.rect.colliderect(self.goblin.rect)
        self._maybe_spawn_reinforcements()

    def draw_world(self):
        screen.fill(C_BG)
        pygame.draw.rect(screen, C_DARK, VILLAGE_BOUNDS, 3)
        self.castle.draw(screen)
        for h in self.houses: h.draw(screen)
        for npc in self.npcs:
            if isinstance(npc, Scout): pygame.draw.circle(screen, C_TORCH, npc.rect.center, 40, width=1)
        for ch in self.chests: ch.draw(screen)
        self.tavern.draw(screen)
        for npc in self.npcs: npc.draw(screen)
        self.goblin.draw(screen)
        top_bar = pygame.Rect(20, 10, WIDTH - 40, 16)
        draw_bar(screen, top_bar, self.detection.value, C_DETECT)
        label = FONT_SMALL.render("Detection", True, C_WHITE); screen.blit(label, (top_bar.x, top_bar.y - 14))
        ttxt = FONT_SMALL.render(f"Threat: {self.threat.value}", True, (220, 120, 140))
        screen.blit(ttxt, (WIDTH - 140, 28))
        if self.goblin.in_tavern and not self.shop.open:
            hint = FONT.render("Press [TAB] to enter Goblin Tavern (Shop)", True, C_GOLD)
            screen.blit(hint, (self.tavern.rect.x - 200, self.tavern.rect.y - 24))

    def draw_hud(self):
        panel = pygame.Rect(0, HEIGHT - HUD_HEIGHT, WIDTH, HUD_HEIGHT)
        pygame.draw.rect(screen, C_PANEL, panel); pygame.draw.rect(screen, C_PANEL_BORDER, panel, 2)
        hb = pygame.Rect(16, HEIGHT - HUD_HEIGHT + 16, 200, 18)
        draw_bar(screen, hb, self.goblin.stats.health / 100.0, C_HEALTH)
        screen.blit(FONT_SMALL.render("Health", True, C_WHITE), (hb.x, hb.y - 14))
        db = pygame.Rect(16, HEIGHT - HUD_HEIGHT + 46, 200, 18)
        draw_bar(screen, db, self.detection.value, C_DETECT)
        screen.blit(FONT_SMALL.render("Stealth (Detection)", True, C_WHITE), (db.x, db.y - 14))
        gold_txt = FONT.render(f"Gold: {self.goblin.gold}", True, C_GOLD)
        screen.blit(gold_txt, (16, HEIGHT - HUD_HEIGHT + 78))
        stats_x = 260; stats_y = HEIGHT - HUD_HEIGHT + 16
        s = self.goblin.stats
        stats_line1 = FONT.render(
            f"Speed: {int(s.speed())}   Attack: {s.attack}   StealthResist: {int(s.stealth_resist*100)}%",
            True, C_WHITE)
        screen.blit(stats_line1, (stats_x, stats_y))
        slot_w, slot_h = 46, 46
        inv_x = WIDTH - (slot_w + 10) * 6 - 16
        inv_y = HEIGHT - HUD_HEIGHT + 16
        for i in range(6):
            r = pygame.Rect(inv_x + i * (slot_w + 10), inv_y, slot_w, slot_h)
            pygame.draw.rect(screen, (35,38,50), r, border_radius=6)
            pygame.draw.rect(screen, (120,120,150), r, 1, border_radius=6)
            it = self.goblin.inventory.slots[i]
            if it:
                initial = FONT_TITLE.render(it.short, True, (220,220,240))
                screen.blit(initial, initial.get_rect(center=r.center))
            hk = FONT_SMALL.render(str(i + 1), True, (180,180,200))
            screen.blit(hk, (r.x + 4, r.y + 2))
        if s.invis_timer > 0:
            invtxt = FONT.render(f"Invisible: {s.invis_timer:0.1f}s", True, (160,200,200))
            screen.blit(invtxt, (stats_x, stats_y + 30))

    def run(self, auto_quit_seconds: float = 0.0):
        elapsed = 0.0
        while True:
            dt = clock.tick(FPS) / 1000.0
            elapsed += dt
            self.handle_events()
            self.update(dt)
            self.draw_world(); self.draw_hud()
            if self.shop.open: self.shop.draw(screen)
            pygame.display.flip()
            if auto_quit_seconds and elapsed >= auto_quit_seconds:
                # why: allow CI/headless smoketest to exit cleanly
                pygame.quit(); return

# ---------------------------- Bootstrap ---------------------------- #

def seed_inventory_for_demo(g):
    # why: ensures consumable path visible without shop
    potion = next(i for i in make_items() if i.id == "potion")
    g.inventory.add(potion)

def main():
    game = Game(fast=ARGS.fast, debug_vision=not ARGS.no_debug)
    seed_inventory_for_demo(game.goblin)
    game.goblin.gold = 120  # quick shop test
    game.run(auto_quit_seconds=ARGS.tick_seconds)

if __name__ == "__main__":
    try:
        main()
    except ImportError:
        print("This demo requires pygame-ce. Install with: pip install -r requirements.txt")
        raise
