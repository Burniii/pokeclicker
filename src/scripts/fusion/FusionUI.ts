// Floating, draggable window of the Fusion world. Position, tab and minimised state are remembered per browser.
class FusionUI {
    public static open: KnockoutObservable<boolean> = ko.observable(false);
    public static minimized: KnockoutObservable<boolean> = ko.observable(false);
    public static tab: KnockoutObservable<'battle' | 'team' | 'dex' | 'shop' | 'credits'> = ko.observable('battle');
    private static readonly STORAGE_KEY = 'fusionWindow';

    public static initialize() {
        try {
            const saved = JSON.parse(localStorage.getItem(FusionUI.STORAGE_KEY) ?? '{}');
            FusionUI.open(!!saved.open);
            FusionUI.minimized(!!saved.minimized);
            if (saved.tab) {
                FusionUI.tab(saved.tab);
            }
            if (saved.left !== undefined) {
                $(document).ready(() => FusionUI.place(saved.left, saved.top));
            }
        } catch {
            // Storage blocked, defaults are fine
        }
        [FusionUI.open, FusionUI.minimized, FusionUI.tab].forEach((o: KnockoutObservable<any>) => o.subscribe(() => FusionUI.store()));
    }

    private static element(): HTMLElement {
        return document.getElementById('fusionWindow');
    }

    private static store() {
        try {
            const el = FusionUI.element();
            localStorage.setItem(FusionUI.STORAGE_KEY, JSON.stringify({
                open: FusionUI.open(),
                minimized: FusionUI.minimized(),
                tab: FusionUI.tab(),
                left: el ? el.offsetLeft : undefined,
                top: el ? el.offsetTop : undefined,
            }));
        } catch {
            // Storage blocked
        }
    }

    private static place(left: number, top: number) {
        const el = FusionUI.element();
        if (!el) {
            return;
        }
        const maxLeft = Math.max(0, window.innerWidth - 120);
        const maxTop = Math.max(0, window.innerHeight - 40);
        el.style.left = `${Math.min(Math.max(0, left), maxLeft)}px`;
        el.style.top = `${Math.min(Math.max(0, top), maxTop)}px`;
        el.style.right = 'auto';
        el.style.bottom = 'auto';
    }

    public static toggle() {
        FusionUI.open(!FusionUI.open());
        if (FusionUI.open()) {
            FusionUI.minimized(false);
        }
    }

    // Drag the window by its title bar
    public static startDrag(_: unknown, event: MouseEvent) {
        if ((event.target as HTMLElement).closest('button')) {
            return true;
        }
        const el = FusionUI.element();
        const startX = event.clientX - el.offsetLeft;
        const startY = event.clientY - el.offsetTop;
        const move = (e: MouseEvent) => FusionUI.place(e.clientX - startX, e.clientY - startY);
        const up = () => {
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', up);
            FusionUI.store();
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
        event.preventDefault();
        return false;
    }

    public static hpPercent = ko.pureComputed(() => {
        const enemy = App.game.fusionWorld.enemy();
        return enemy ? Math.max(0, enemy.hp / enemy.maxHp * 100) : 0;
    });

    public static typeNames(id: string): string {
        return FusionData.types(id).map((t) => PokemonType[t]).join(' / ');
    }

    public static areaLabel(area: FusionArea): string {
        const world = App.game.fusionWorld;
        if (!world.areaUnlocked(area)) {
            if (area.unlock.badge) {
                return `🔒 ${area.name} (benötigt ${area.unlock.badge})`;
            }
            const needed = area.unlock.kills - (world.kills()[area.unlock.area] ?? 0);
            return `🔒 ${area.name} (noch ${needed} Siege auf ${FusionData.area(area.unlock.area).name})`;
        }
        if (area.kind === 'gym') {
            return `${world.badges().includes(area.badge) ? '🏅' : '🏟️'} ${area.name}`;
        }
        const total = area.pokemon.length;
        const caught = area.pokemon.filter((id) => world.isCaught(id)).length;
        return `${caught === total ? '✔' : '🌿'} ${area.name} (${caught}/${total})`;
    }
}
