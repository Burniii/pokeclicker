// Decides which music fits what the player is currently doing
class MusicDirector {
    public static initialize() {
        Music.initialize(() => MusicDirector.situation());
    }

    public static situation(): MusicSituation | undefined {
        const region = Math.max(0, player.region);
        switch (App.game.gameState) {
            case GameConstants.GameState.fighting:
                return { kind: 'route', region };
            case GameConstants.GameState.gym: {
                const gym = GymRunner.gymObservable();
                const important = /Champion|Elite/.test(`${gym?.town ?? ''} ${gym?.leaderName ?? ''}`);
                return { kind: important ? 'champion' : 'battle', region };
            }
            case GameConstants.GameState.dungeon:
                return { kind: DungeonRunner.fightingBoss() ? 'boss' : 'dungeon', region };
            case GameConstants.GameState.temporaryBattle: {
                const battle = TemporaryBattleRunner.battleObservable();
                if (/^(Masters|Apex|Monarch)/.test(battle?.name ?? '')) {
                    return { kind: 'champion', region };
                }
                return { kind: battle?.getPokemonList().length === 1 ? 'legendary' : 'battle', region };
            }
            case GameConstants.GameState.battleFrontier:
                return { kind: 'battle', region };
            case GameConstants.GameState.loading:
                return undefined;
            default:
                return { kind: 'town', region };
        }
    }
}
