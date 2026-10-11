/// <reference path="../AutomationFeature.ts" />

type MineMove = { tool: UndergroundToolType, x: number, y: number, value: number };

// Digs in the underground: survey, battery discharge, safe bombs, then chisel/hammer on the most promising tiles
class AutoMine extends AutomationFeature {
    id = 'mine';
    name = 'Untergrund';
    icon = '⛏️';
    group: AutomationGroup = 'basis';
    description = 'Gräbt automatisch im Untergrund und wählt dabei das günstigste Werkzeug.';
    unlockHint = 'Schalte den Untergrund frei und besiege den Kanto-Champion.';
    interval = 300;
    private actions = 0;
    private idle = true;

    settingDefs: AutomationSettingDef[] = [
        { key: 'useSurvey', label: 'Vermessung (Survey) nutzen', type: 'bool', default: true },
        { key: 'useBomb', label: 'Bombe nutzen, wenn dabei kein Fundstück zerstört werden kann', type: 'bool', default: true },
        { key: 'useBattery', label: 'Zellbatterie entladen, wenn sie voll ist', type: 'bool', default: true },
        { key: 'useHammer', label: 'Hammer nutzen', type: 'bool', default: true },
    ];

    public isUnlocked(): boolean {
        return App.game.underground.canAccess() && App.game.badgeCase.hasBadge(BadgeEnums.Elite_KantoChampion);
    }

    public run() {
        const acted = this.act();
        if (acted) {
            this.actions++;
            this.idle = false;
        } else if (!this.idle) {
            this.idle = true;
            this.status(`${this.actions.toLocaleString('de-DE')} Grab-Aktionen ausgeführt`);
        }
    }

    private act(): boolean {
        const underground = App.game.underground;
        const mine = underground.mine;
        if (!mine || mine.timeUntilDiscovery > 0 || mine.completed || mine.itemsFound >= mine.itemsBuried) {
            return false;
        }
        const tools = underground.tools;
        const center = { x: Math.floor(mine.width / 2), y: Math.floor(mine.height / 2) };
        const hidden = Mine.hiddenItemsIDSet(mine);

        if (this.setting('useSurvey') && hidden.size > 0 && tools.getTool(UndergroundToolType.Survey).canUseTool()
            && !mine.grid.some((tile) => tile.survey > 0 && hidden.has(tile.surveyRewardID))) {
            tools.useTool(UndergroundToolType.Survey, center.x, center.y);
            return true;
        }
        if (this.setting('useBattery') && App.game.oakItems.isActive(OakItemType.Cell_Battery)
            && underground.battery.charges >= underground.battery.maxCharges) {
            underground.battery.discharge();
            return true;
        }
        const bomb = tools.getTool(UndergroundToolType.Bomb);
        if (this.setting('useBomb') && hidden.size > 0 && bomb.canUseTool() && this.bombIsSafe()) {
            tools.useTool(UndergroundToolType.Bomb, center.x, center.y);
            return true;
        }
        const move = this.bestMove(hidden);
        if (!move) {
            return false;
        }
        tools.useTool(move.tool, move.x, move.y);
        return true;
    }

    // A bomb mines up to two layers on random tiles; it can only destroy an item that it would finish
    private bombIsSafe(): boolean {
        const mine = App.game.underground.mine;
        const deepest: Record<number, number> = {};
        mine.grid.forEach((tile) => {
            if (tile.reward && !tile.reward.rewarded) {
                deepest[tile.reward.rewardID] = Math.max(deepest[tile.reward.rewardID] ?? 0, tile.layerDepth);
            }
        });
        return Object.values(deepest).every((depth) => depth > 2);
    }

    private bestMove(hidden: Set<number>): MineMove | null {
        const mine = App.game.underground.mine;
        const tools = App.game.underground.tools;
        const canChisel = tools.getTool(UndergroundToolType.Chisel).canUseTool();
        const canHammer = this.setting('useHammer') && tools.getTool(UndergroundToolType.Hammer).canUseTool();
        if (!canChisel && !canHammer) {
            return null;
        }
        const revealed = Mine.partiallyFoundItemsIDSet(mine);
        Mine.foundItemsIDSet(mine).forEach((id) => revealed.delete(id));

        // 1. Finish items that are already partly visible
        let targets = new Set<number>();
        mine.grid.forEach((tile, i) => {
            if (tile.layerDepth > 0 && tile.reward && revealed.has(tile.reward.rewardID)) {
                targets.add(i);
            }
        });
        // 2. Otherwise dig inside an active survey area, or anywhere
        if (!targets.size) {
            const surveyed = this.surveyArea(hidden);
            mine.grid.forEach((tile, i) => {
                if (tile.layerDepth > 0 && (!surveyed || surveyed.has(i))) {
                    targets.add(i);
                }
            });
            if (!targets.size && surveyed) {
                targets = new Set(mine.grid.map((t, i) => (t.layerDepth > 0 ? i : -1)).filter((i) => i >= 0));
            }
        }
        if (!targets.size) {
            return null;
        }

        let best: MineMove = null;
        const consider = (move: MineMove) => {
            if (!best || move.value > best.value) {
                best = move;
            }
        };
        const chiselCost = tools.getTool(UndergroundToolType.Chisel).durabilityPerUse;
        const hammerCost = tools.getTool(UndergroundToolType.Hammer).durabilityPerUse;
        targets.forEach((index) => {
            const { x, y } = mine.getCoordinateForGridIndex(index);
            if (canChisel) {
                // Prefer tiles close to the centre of the remaining area so items are found sooner
                consider({ tool: UndergroundToolType.Chisel, x, y, value: Math.min(mine.grid[index].layerDepth, 2) / chiselCost + this.neighbours(index, targets) * 0.01 });
            }
            if (canHammer) {
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        const cx = x + dx;
                        const cy = y + dy;
                        if (cx < 0 || cy < 0 || cx >= mine.width || cy >= mine.height) {
                            continue;
                        }
                        const covered = this.hammerCoverage(cx, cy, targets);
                        consider({ tool: UndergroundToolType.Hammer, x: cx, y: cy, value: covered / hammerCost });
                    }
                }
            }
        });
        return best;
    }

    private hammerCoverage(x: number, y: number, targets: Set<number>): number {
        const mine = App.game.underground.mine;
        let n = 0;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const i = mine.getGridIndexForCoordinate({ x: x + dx, y: y + dy });
                if (i >= 0 && targets.has(i)) {
                    n++;
                }
            }
        }
        return n;
    }

    private neighbours(index: number, targets: Set<number>): number {
        const { x, y } = App.game.underground.mine.getCoordinateForGridIndex(index);
        return this.hammerCoverage(x, y, targets) - 1;
    }

    // Tiles inside the box of a survey that still points at an undiscovered item
    private surveyArea(hidden: Set<number>): Set<number> | null {
        const mine = App.game.underground.mine;
        const area = new Set<number>();
        mine.grid.forEach((tile, i) => {
            if (!(tile.survey > 0) || !hidden.has(tile.surveyRewardID)) {
                return;
            }
            const { x, y } = mine.getCoordinateForGridIndex(i);
            const half = Math.floor(tile.survey / 2);
            for (let dx = -half; dx <= half; dx++) {
                for (let dy = -half; dy <= half; dy++) {
                    const j = mine.getGridIndexForCoordinate({ x: x + dx, y: y + dy });
                    if (j >= 0) {
                        area.add(j);
                    }
                }
            }
        });
        return area.size ? area : null;
    }
}
