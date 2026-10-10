import { TypeColor } from '../GameConstants';
import PokemonType from '../enums/PokemonType';
import Settings from '../settings/Settings';

const MAX_ACTIVE = 40;

// Lightweight DOM/CSS battle effects on top of the battle view
export default class BattleEffects {
    private static active = 0;
    private static lastPointer: { x: number, y: number } | undefined;
    private static listening = false;

    private static enabled(effect: string): boolean {
        if (document.hidden || !Settings.getSetting(`battleEffects.${effect}`)?.value) {
            return false;
        }
        return !(Settings.getSetting('battleEffects.respectReducedMotion')?.value && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    }

    private static layer(): HTMLElement | null {
        BattleEffects.listen();
        return document.querySelector('#battleContainer .battle-view');
    }

    private static listen() {
        if (BattleEffects.listening) {
            return;
        }
        BattleEffects.listening = true;
        document.addEventListener('pointerdown', (e) => {
            const layer = document.querySelector('#battleContainer .battle-view');
            if (layer?.contains(e.target as Node)) {
                const rect = layer.getBoundingClientRect();
                BattleEffects.lastPointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            }
        }, { passive: true });
    }

    private static spawn(className: string, x: number, y: number, style: Partial<CSSStyleDeclaration> = {}, text = ''): void {
        const layer = BattleEffects.layer();
        if (!layer || BattleEffects.active >= MAX_ACTIVE) {
            return;
        }
        const el = document.createElement('div');
        el.className = `battle-effect ${className}`;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        Object.assign(el.style, style);
        el.textContent = text;
        BattleEffects.active++;
        const remove = () => {
            if (el.parentNode) {
                el.remove();
                BattleEffects.active--;
            }
        };
        el.addEventListener('animationend', remove);
        setTimeout(remove, 3000);
        layer.appendChild(el);
    }

    private static center(): { x: number, y: number } {
        const layer = BattleEffects.layer();
        const width = layer?.clientWidth ?? 300;
        return { x: width / 2, y: 140 };
    }

    private static typeColor(type: PokemonType): string {
        return TypeColor[type] ?? '#ffffff';
    }

    public static clickHit(damage: number, type: PokemonType) {
        const point = BattleEffects.lastPointer ?? BattleEffects.center();
        const jitter = (range: number) => (Math.random() - 0.5) * range;
        if (BattleEffects.enabled('damageNumbers')) {
            BattleEffects.spawn('battle-effect-damage', point.x + jitter(90), point.y - 10 + jitter(30), {}, `-${Math.round(damage).toLocaleString('en-US')}`);
        }
        if (BattleEffects.enabled('particles')) {
            const color = BattleEffects.typeColor(type);
            for (let i = 0; i < 4; i++) {
                const angle = Math.random() * Math.PI * 2;
                const distance = 20 + Math.random() * 25;
                BattleEffects.spawn('battle-effect-particle', point.x, point.y, {
                    background: color,
                    ['--dx' as any]: `${Math.cos(angle) * distance}px`,
                    ['--dy' as any]: `${Math.sin(angle) * distance}px`,
                });
            }
        }
    }

    public static defeat(type: PokemonType) {
        if (!BattleEffects.enabled('particles')) {
            return;
        }
        const { x, y } = BattleEffects.center();
        const color = BattleEffects.typeColor(type);
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            BattleEffects.spawn('battle-effect-particle battle-effect-burst', x, y + 10, {
                background: color,
                ['--dx' as any]: `${Math.cos(angle) * 55}px`,
                ['--dy' as any]: `${Math.sin(angle) * 55}px`,
            });
        }
    }

    public static shiny() {
        if (!BattleEffects.enabled('shiny')) {
            return;
        }
        const { x, y } = BattleEffects.center();
        for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 25 + Math.random() * 45;
            BattleEffects.spawn('battle-effect-sparkle', x + Math.cos(angle) * distance, y + 10 + Math.sin(angle) * distance, {
                animationDelay: `${Math.random() * 0.8}s`,
            }, '✦');
        }
    }

    public static banner(title: string, subtitle = '') {
        if (!BattleEffects.enabled('banner')) {
            return;
        }
        const layer = BattleEffects.layer();
        if (!layer) {
            return;
        }
        const el = document.createElement('div');
        el.className = 'battle-effect battle-effect-banner';
        const strong = document.createElement('strong');
        strong.textContent = title;
        el.appendChild(strong);
        if (subtitle) {
            const small = document.createElement('span');
            small.textContent = subtitle;
            el.appendChild(small);
        }
        el.addEventListener('animationend', () => el.remove());
        setTimeout(() => el.remove(), 4000);
        layer.appendChild(el);
    }
}
