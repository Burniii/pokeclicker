// Registers the translations shipped with this fork for quest lines and settings
class BundledTranslations {
    private static readonly languages = {
        de: { questlines: bundledQuestlinesDe, settings: bundledSettingsDe, cutscenes: bundledCutscenesDe, npcDialogs: bundledNpcDialogsDe, npcNames: bundledNpcNamesDe, pokemon: bundledPokemonDe },
    };

    public static register() {
        Object.entries(BundledTranslations.languages).forEach(([language, texts]) => {
            const questlines: Record<string, string> = {};
            const add = (key: string | undefined, english: string) => {
                const translated = texts.questlines[english];
                if (key && translated) {
                    questlines[App.translation.translationHashKey(key, english)] = translated;
                }
            };
            App.game.quests.questLines().forEach((ql) => {
                add(`${ql.name}.displayName`, ql.name);
                add(`${ql.name}.description`, ql.defaultDescription);
                ql.quests().forEach((quest) => {
                    add(quest.translationKey(), quest.englishDescription);
                    if (quest instanceof MultipleQuestsQuest) {
                        quest.quests.forEach((task) => add(task.translationKey(), task.englishDescription));
                    }
                });
            });
            // NPC dialog lines and names, keyed by their English text (see NPC.translate)
            Object.entries(texts.npcDialogs).forEach(([english, translated]) => {
                questlines[App.translation.translationHashKey(NPC.DIALOG_KEY, english)] = translated;
            });
            Object.entries(texts.npcNames).forEach(([english, translated]) => {
                questlines[App.translation.translationHashKey(NPC.NAME_KEY, english)] = translated;
            });
            App.translation.addBundledResources(language, 'questlines', { ...questlines, ...texts.cutscenes });
            App.translation.addBundledResources(language, 'settings', texts.settings);
            App.translation.addBundledResources(language, 'pokemon', texts.pokemon);
        });
    }
}
