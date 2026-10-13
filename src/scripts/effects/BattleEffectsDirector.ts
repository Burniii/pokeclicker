// Connects the battle effects to battle events of the scripts code base
class BattleEffectsDirector {
    private static initialized = false;

    public static initialize() {
        if (BattleEffectsDirector.initialized) {
            return;
        }
        BattleEffectsDirector.initialized = true;
        Battle.enemyPokemon.subscribe((pokemon) => {
            if (pokemon?.shiny) {
                // wait until the new sprite is rendered
                setTimeout(() => BattleEffects.shiny(), 50);
            }
        });
        DungeonRunner.fightingBoss.subscribe((boss) => {
            if (boss) {
                setTimeout(() => BattleEffects.banner('Boss', Battle.enemyPokemon()?.displayName ?? ''), 100);
            }
        });
        GymRunner.running.subscribe((running) => {
            const gym = GymRunner.gymObservable();
            if (running && gym) {
                BattleEffects.banner(gym.leaderName.replace(/\s?\d/g, ''), gym.town);
            }
        });
        TemporaryBattleRunner.running.subscribe((running) => {
            const battle = TemporaryBattleRunner.battleObservable();
            if (running && battle) {
                BattleEffects.banner(battle.getDisplayName());
            }
        });
    }
}
