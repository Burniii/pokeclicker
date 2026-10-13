import { composeLoop, trackConfig } from './Music';

describe('Music', () => {
    it('composes the same loop for the same track', () => {
        const a = composeLoop(trackConfig('region:3'));
        const b = composeLoop(trackConfig('region:3'));
        expect(a.notes).toEqual(b.notes);
        expect(a.duration).toBeGreaterThan(10);
    });

    it('has a theme for every region and situation', () => {
        for (let region = 0; region <= 9; region++) {
            expect(trackConfig(`region:${region}`)).toBeDefined();
            expect(trackConfig(`town:${region}`).style).toBe('calm');
        }
        ['battle', 'dungeon', 'boss', 'champion', 'legendary'].forEach((kind) => expect(trackConfig(kind)).toBeDefined());
    });

    it('keeps every note inside the loop', () => {
        ['region:9', 'boss', 'town:0'].forEach((track) => {
            const loop = composeLoop(trackConfig(track));
            loop.notes.forEach((n) => {
                expect(n.start).toBeGreaterThanOrEqual(0);
                expect(n.start + n.duration).toBeLessThanOrEqual(loop.duration + 0.5);
                expect(Number.isFinite(n.freq)).toBe(true);
            });
        });
    });
});
