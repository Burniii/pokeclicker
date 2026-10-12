class ProfNPC extends NPC {

    constructor(
        public name: string,
        public region: GameConstants.Region,
        public pokedexCompleteText: string,
        public nextRegionUnlockedText: string,
        image: string = undefined,
        requirement?: Requirement | MultiRequirement | OneFromManyRequirement
    ) {
        super(name, undefined, { image: image, requirement: requirement});
    }

    get dialogHTML(): string {
        const requiresCompleteDex = App.game.challenges.list.requireCompletePokedex.active();
        const nextRegionUnlocked = TownList[GameConstants.StartingTowns[this.region + 1]]?.isUnlocked() ?? false;
        const completeDexAchievement = AchievementHandler.findByName(`${GameConstants.camelCaseToString(GameConstants.Region[this.region])} Master`);


        if (!nextRegionUnlocked) {
            return `<p>${NPC.translate('Hello, new Champion, you\'ve come a long way!')}</p>
                    <p>${NPC.translate('Come see me once you\'ve beat the Elite Four!')}</p>`;
        }

        let html = '';

        if (completeDexAchievement.isCompleted()) {
            html += `<p>${NPC.translate(this.pokedexCompleteText)}</p>`;
        } else {
            if (requiresCompleteDex) {
                html += `<p>${NPC.translate('To progress to the next region, you need to catch all Pokémon native to this region.')}</p>`;
            }
            const left = completeDexAchievement.property.requiredValue - completeDexAchievement.getProgress();
            html += `<p>${NPC.translate('You still have {COUNT} left to catch in this region! You\'re almost there!').replace('{COUNT}', `${left}`)}</p>`;
        }

        if (nextRegionUnlocked && (completeDexAchievement.isCompleted() || !requiresCompleteDex)) {
            html += `<p>${NPC.translate(this.nextRegionUnlockedText)}</p>`;
        }

        return html;
    }
}
