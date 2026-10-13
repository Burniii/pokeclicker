// Shared helpers for expeditions, ranch and fishing
class Activities {
    public static expeditionsUnlocked = ko.pureComputed(() => App.game.badgeCase.hasBadge(BadgeEnums.Elite_KantoChampion));
    public static ranchUnlocked = ko.pureComputed(() => player.highestRegion() >= GameConstants.Region.johto);

    // 0 = no rod, 1 = Old Rod, 2 = Good Rod, 3 = Super Rod
    public static rod = ko.pureComputed(() => {
        if (player.highestRegion() >= GameConstants.Region.hoenn) {
            return 3;
        }
        if (player.highestRegion() >= GameConstants.Region.johto) {
            return 2;
        }
        return App.game.badgeCase.hasBadge(BadgeEnums.Thunder) ? 1 : 0;
    });

    public static readonly rodNames = ['No rod', 'Old Rod', 'Good Rod', 'Super Rod'];

    public static isAway(id: number): boolean {
        return App.game.expeditions.awayIds().has(id) || App.game.ranch.residentIds().has(id);
    }

    public static awayReason(id: number): string {
        if (App.game.expeditions.awayIds().has(id)) {
            return 'on an expedition';
        }
        if (App.game.ranch.residentIds().has(id)) {
            return 'living on the ranch';
        }
        return '';
    }

    // Pokémon that can be sent on an activity
    public static available(): PartyPokemon[] {
        return App.game.party.caughtPokemon.filter((p) => p.id > 0 && !p.breeding && !Activities.isAway(p.id));
    }

    public static attackOf(pokemon: PartyPokemon): number {
        return pokemon.attack * App.game.pokemonTraits.attackMultiplier(pokemon.id);
    }

    public static formatDuration(ms: number): string {
        if (ms <= 0) {
            return 'done';
        }
        const minutes = Math.ceil(ms / 60000);
        const hours = Math.floor(minutes / 60);
        return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
    }

    public static now = ko.observable(Date.now());

    private static announce(title: string, message: string) {
        Notifier.notify({
            title,
            message: `${message}\n<i>Open "Activities" in the game menu.</i>`,
            type: NotificationConstants.NotificationOption.info,
            timeout: 30 * 1000,
        });
    }

    public static initialize() {
        // Tell the player when a new activity becomes available during the journey
        Activities.expeditionsUnlocked.subscribe((unlocked) => unlocked && Activities.announce('Expeditions unlocked',
            'You can now send Pokémon on expeditions for items, currencies and bond.'));
        Activities.ranchUnlocked.subscribe((unlocked) => unlocked && Activities.announce('Ranch unlocked',
            'Pokémon living on the ranch produce resources by type.'));
        Activities.rod.subscribe((rod) => rod > 0 && Activities.announce(`${Activities.rodNames[rod]} obtained`,
            'Look for the 🎣 button on routes with water Pokémon.'));
        player.highestRegion.subscribe((region) => region === GameConstants.Region.paldea && Activities.announce('Tera types unlocked',
            'Collect Tera Shards on Paldea expeditions and while fishing, then give your Pokémon a Tera type in the Care tab.'));
        setInterval(() => {
            Activities.now(Date.now());
            App.game.expeditions.checkFinished();
        }, 10 * 1000);
    }
}
