/// <reference path="./FusionData.ts" />

// Filters and sorting of the Fusion dex. It is built like the Pokédex, but the filters fit fusions:
// head and body Pokémon instead of region, the Fusion area instead of categories, no Pokérus/shiny/held items.
class FusionDex {
    public static search: KnockoutObservable<string> = ko.observable('');
    public static type1: KnockoutObservable<number> = ko.observable(-1);
    public static type2: KnockoutObservable<number> = ko.observable(-1);
    public static head: KnockoutObservable<number> = ko.observable(0);
    public static body: KnockoutObservable<number> = ko.observable(0);
    public static area: KnockoutObservable<string> = ko.observable('');
    public static status: KnockoutObservable<string> = ko.observable('all');
    public static sort: KnockoutObservable<string> = ko.observable('id');
    public static descending: KnockoutObservable<boolean> = ko.observable(false);

    public static readonly statusOptions = [
        { value: 'all', text: 'Alle' },
        { value: 'caught', text: 'Gefangen' },
        { value: 'uncaught', text: 'Nicht gefangen' },
        { value: 'seen', text: 'Gesehen, nicht gefangen' },
        { value: 'unseen', text: 'Noch nie gesehen' },
    ];

    public static readonly sortOptions = [
        { value: 'id', text: 'Fusions-Nr. (Kopf.Körper)' },
        { value: 'name', text: 'Name' },
        { value: 'attack', text: 'Angriff' },
        { value: 'level', text: 'Level' },
        { value: 'catchRate', text: 'Fangrate' },
    ];

    public static readonly typeOptions = [{ value: -1, text: 'Alle' }].concat(
        GameHelper.enumNumbers(PokemonType).filter((t) => t !== PokemonType.None).map((t) => ({ value: t, text: PokemonType[t] }))
    );

    public static readonly typeOptions2 = [{ value: -1, text: 'Alle' }, { value: PokemonType.None, text: 'Kein (einfacher Typ)' }].concat(
        GameHelper.enumNumbers(PokemonType).filter((t) => t !== PokemonType.None).map((t) => ({ value: t, text: PokemonType[t] }))
    );

    private static partOptions(part: 'head' | 'body') {
        const ids = [...new Set(FusionData.species.map((s) => s[part]))].sort((a, b) => a - b);
        return [{ value: 0, text: 'Alle' }].concat(ids.map((id) => ({ value: id, text: `#${String(id).padStart(3, '0')} ${PokemonHelper.displayName(pokemonMap[id].name)}` })));
    }

    public static headOptions = ko.pureComputed(() => FusionDex.partOptions('head'));
    public static bodyOptions = ko.pureComputed(() => FusionDex.partOptions('body'));

    public static readonly areaOptions = [{ value: '', text: 'Alle' }, { value: 'starter', text: 'Starter (Fusionslabor)' }].concat(
        FusionData.areas.filter((a) => a.pokemon || a.team).map((a) => ({ value: a.id, text: a.kind === 'gym' ? `${a.name} (Arenaleiterin)` : a.name }))
    );

    public static reset() {
        FusionDex.search('');
        FusionDex.type1(-1);
        FusionDex.type2(-1);
        FusionDex.head(0);
        FusionDex.body(0);
        FusionDex.area('');
        FusionDex.status('all');
        FusionDex.sort('id');
        FusionDex.descending(false);
    }

    public static showMissing() {
        FusionDex.reset();
        FusionDex.status('uncaught');
    }

    public static number(id: string): string {
        const s = FusionData.speciesById(id);
        return `${String(s.head).padStart(3, '0')}.${String(s.body).padStart(3, '0')}`;
    }

    public static level(id: string): number {
        const mon = App.game.fusionWorld.caught().find((m) => m.id === id);
        return mon ? FusionWorld.levelOf(mon) : 0;
    }

    private static matches(s: FusionSpecies): boolean {
        const world = App.game.fusionWorld;
        const term = FusionDex.search().trim().toLowerCase();
        if (term) {
            // Names of unseen fusions stay hidden, like in the Pokédex
            const names = [s.id, FusionDex.number(s.id)];
            if (world.isSeen(s.id)) {
                names.push(s.name, PokemonHelper.displayName(pokemonMap[s.head].name), PokemonHelper.displayName(pokemonMap[s.body].name));
            }
            if (!names.some((n) => n.toLowerCase().includes(term))) {
                return false;
            }
        }
        const types = FusionData.types(s.id);
        if (FusionDex.type1() !== -1 && types[0] !== FusionDex.type1()) {
            return false;
        }
        if (FusionDex.type2() !== -1 && (types[1] ?? PokemonType.None) !== FusionDex.type2()) {
            return false;
        }
        if (FusionDex.head() && s.head !== FusionDex.head()) {
            return false;
        }
        if (FusionDex.body() && s.body !== FusionDex.body()) {
            return false;
        }
        const area = FusionDex.area();
        if (area === 'starter' && !FusionData.starters.includes(s.id)) {
            return false;
        }
        if (area && area !== 'starter' && !FusionData.foundIn(s.id).some((a) => a.id === area)) {
            return false;
        }
        const caught = world.isCaught(s.id);
        const seen = world.isSeen(s.id);
        switch (FusionDex.status()) {
            case 'caught': return caught;
            case 'uncaught': return !caught;
            case 'seen': return seen && !caught;
            case 'unseen': return !seen;
            default: return true;
        }
    }

    public static filteredList = ko.pureComputed(() => {
        const sortValue = (s: FusionSpecies): number | string => {
            switch (FusionDex.sort()) {
                case 'name': return s.name;
                case 'attack': return FusionData.attack(s.id);
                case 'level': return FusionDex.level(s.id);
                case 'catchRate': return FusionData.catchRate(s.id);
                default: return s.head * 1000 + s.body;
            }
        };
        const list = FusionData.species.filter((s) => FusionDex.matches(s)).sort((a, b) => {
            const va = sortValue(a);
            const vb = sortValue(b);
            const cmp = typeof va === 'string' ? va.localeCompare(vb as string, 'de') : va - (vb as number);
            return cmp || (a.head * 1000 + a.body) - (b.head * 1000 + b.body);
        });
        return FusionDex.descending() ? list.reverse() : list;
    });

    // Card background in the type colours, grey when never seen (same as the Pokédex)
    public static background(id: string): string {
        if (!App.game.fusionWorld.isSeen(id)) {
            return 'grey';
        }
        const types = FusionData.types(id);
        if (types.length === 1) {
            return GameConstants.TypeColor[types[0]];
        }
        return `linear-gradient(90deg,${GameConstants.TypeColor[types[0]]} 50%, ${GameConstants.TypeColor[types[1]]} 50%)`;
    }

    public static tooltip(id: string): string {
        const s = FusionData.speciesById(id);
        const found = FusionData.foundIn(id).map((a) => a.name);
        if (FusionData.starters.includes(id)) {
            found.unshift('Starter im Fusionslabor');
        }
        const level = FusionDex.level(id);
        return `<u>Information:</u>
            <br/>Kopf: <strong>${PokemonHelper.displayName(pokemonMap[s.head].name)}</strong> · Körper: <strong>${PokemonHelper.displayName(pokemonMap[s.body].name)}</strong>
            <br/>Typen: <strong>${FusionUI.typeNames(id)}</strong>
            <br/>Angriff: <strong>${FusionData.attack(id)}</strong>
            <br/>Fangrate: <strong>${Math.round(FusionData.catchRate(id))}</strong>${level ? `<br/>Level: <strong>${level}</strong>` : ''}
            <br/>Fundort: <strong>${found.join(', ') || '–'}</strong>
            <br/><small>Sprite: ${s.artist} (Pokémon Infinite Fusion)</small>`;
    }
}
