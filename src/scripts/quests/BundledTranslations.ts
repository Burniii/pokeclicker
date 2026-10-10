// Registers the translations shipped with this fork for quest lines and settings
class BundledTranslations {
    private static readonly languages = {
        de: { questlines: bundledQuestlinesDe, settings: bundledSettingsDe, cutscenes: bundledCutscenesDe },
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
            App.translation.addBundledResources(language, 'questlines', { ...questlines, ...texts.cutscenes });
            App.translation.addBundledResources(language, 'settings', texts.settings);
        });
    }
}
