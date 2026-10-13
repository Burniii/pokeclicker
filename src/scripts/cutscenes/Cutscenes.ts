/// <reference path="../../declarations/DataStore/common/Saveable.d.ts" />

type CutsceneSprite = {
    image: string,
    position: 'left' | 'center' | 'right',
    size?: number, // px
    enter?: 'fade' | 'slide-left' | 'slide-right' | 'rise',
    glow?: string, // css color
};

type CutsceneFrame = {
    text: string,
    speaker?: string,
    background?: string, // css background
    sprites?: CutsceneSprite[],
};

type CutsceneDefinition = {
    id: string,
    title: string,
    frames: () => CutsceneFrame[],
};

// Short skippable story scenes, each one is shown once and can be replayed from the gallery
class Cutscenes implements Saveable {
    saveKey = 'cutscenes';
    defaults: Record<string, any> = { seen: [] };

    public seen: KnockoutObservableArray<string> = ko.observableArray([]);
    public current: KnockoutObservable<CutsceneDefinition> = ko.observable(undefined);
    public index: KnockoutObservable<number> = ko.observable(0);
    private frames: CutsceneFrame[] = [];
    public frame: KnockoutObservable<CutsceneFrame> = ko.observable(undefined);

    public static list: Record<string, CutsceneDefinition> = {};

    public static add(definition: CutsceneDefinition) {
        Cutscenes.list[definition.id] = definition;
    }

    public static pokemonImage(name: PokemonNameType, shiny = false): string {
        const pokemon = pokemonMap[name];
        return pokemon ? PokemonHelper.getImage(pokemon.id, shiny) : '';
    }

    public static npcImage(name: string): string {
        return `assets/images/npcs/${name}.png`;
    }

    public static regionBackground(image: string): string {
        return `linear-gradient(rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.65)), url('assets/images/${image}') center / cover`;
    }

    public static text(id: string, index: number, english: string): string {
        return App.translation.get(`cutscene.${id}.${index}`, 'questlines', { defaultValue: english })();
    }

    public initialize() {
        player.highestRegion.subscribe((region) => this.trigger(`region-${region}`));
    }

    public isEnabled(): boolean {
        return !!Settings.getSetting('cutscenes.enabled')?.observableValue();
    }

    // Plays a cutscene the first time its event happens
    public trigger(id: string) {
        if (!Cutscenes.list[id] || this.seen().includes(id)) {
            return;
        }
        this.seen.push(id);
        if (this.isEnabled()) {
            // Let the triggering screen (battle won, region change) finish first
            setTimeout(() => this.play(id), 600);
        }
    }

    public play(id: string) {
        const definition = Cutscenes.list[id];
        if (!definition) {
            return;
        }
        this.frames = definition.frames();
        this.current(definition);
        this.index(0);
        this.frame(this.frames[0]);
        $('#cutsceneModal').modal('show');
    }

    public next() {
        if (this.index() < this.frames.length - 1) {
            this.index(this.index() + 1);
            this.frame(this.frames[this.index()]);
        } else {
            this.close();
        }
    }

    public close() {
        $('#cutsceneModal').modal('hide');
    }

    public gallery(): CutsceneDefinition[] {
        return Object.values(Cutscenes.list).filter((c) => this.seen().includes(c.id));
    }

    toJSON(): Record<string, any> {
        return { seen: this.seen() };
    }

    fromJSON(json: Record<string, any>): void {
        this.seen(Array.isArray(json?.seen) ? json.seen : []);
    }
}
