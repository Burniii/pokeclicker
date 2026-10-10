import NotificationOption from './NotificationOption';
import Sound from '../utilities/Sound';
import Rand from '../utilities/Rand';
import type NotificationSetting from '../settings/NotificationSetting';
import Settings from '../settings/Settings';

export type NotificationHistoryEntry = {
    key: string;
    time: Date;
    title: string;
    message: string;
    type: NotificationOption;
    count: number;
    suppressed: boolean;
};

const HISTORY_SIZE = 200;
const IDLE_TIME = 2 * 60 * 1000;

export default class Notifier {
    public static history: KnockoutObservableArray<NotificationHistoryEntry> = ko.observableArray([]);
    // Notifications hidden by "do not disturb" since the history was last opened
    public static unseenSuppressed: KnockoutObservable<number> = ko.observable(0);
    private static activeToasts = new Map<string, { id: string, count: number, timer?: ReturnType<typeof setTimeout> }>();
    private static lastInput = Date.now();
    private static inputListening = false;

    private static listenForInput() {
        if (Notifier.inputListening) {
            return;
        }
        Notifier.inputListening = true;
        ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel'].forEach((event) => {
            document.addEventListener(event, () => { Notifier.lastInput = Date.now(); }, { passive: true });
        });
    }

    // Only game event notifications (the ones with a notification setting) are held back, direct feedback is always shown
    public static isDoNotDisturb(setting?: NotificationSetting): boolean {
        if (!setting) {
            return false;
        }
        const mode = Settings.getSetting('notificationDoNotDisturb')?.value ?? 'off';
        if (mode === 'always') {
            return true;
        }
        return mode === 'idle' && Date.now() - Notifier.lastInput > IDLE_TIME;
    }

    private static addToHistory(key: string, title: string, message: string, type: NotificationOption, suppressed: boolean) {
        const last = Notifier.history()[0];
        if (last && last.key === key) {
            Notifier.history.splice(0, 1, { ...last, time: new Date(), count: last.count + 1, suppressed: last.suppressed && suppressed });
        } else {
            Notifier.history.unshift({ key, time: new Date(), title, message, type, count: 1, suppressed });
            if (Notifier.history().length > HISTORY_SIZE) {
                Notifier.history.pop();
            }
        }
        if (suppressed) {
            Notifier.unseenSuppressed(Notifier.unseenSuppressed() + 1);
        }
    }

    public static clearHistory() {
        Notifier.history([]);
        Notifier.unseenSuppressed(0);
    }

    public static notify({
        message,
        type = NotificationOption.primary,
        title = '',
        timeout = 3000,
        time = 'just now',
        sound,
        setting,
        image,
        pokemonImage,
        strippedMessage,
    }: {
        message?: string;
        type?: NotificationOption;
        title?: string;
        timeout?: number;
        time?: string;
        sound?: Sound;
        setting?: NotificationSetting;
        image?: string;
        pokemonImage?: string;
        strippedMessage?: string;
    }): void {
        $(document).ready(() => {
            Notifier.listenForInput();
            const key = `${type}|${title}|${message}`;
            const doNotDisturb = Notifier.isDoNotDisturb(setting);
            const inGameDisabled = setting && setting.inGameNotification && !setting.inGameNotification.value;
            if (Settings.getSetting('notificationHistory')?.value ?? true) {
                Notifier.addToHistory(key, title, message ?? '', type, doNotDisturb && !inGameDisabled);
            }
            // If we have sounds enabled for this, play it now
            if (sound && !doNotDisturb) {
                sound.play();
            }

            // Desktop notifications are still sent while idle, only "always" silences them
            const desktopAllowed = !doNotDisturb || Settings.getSetting('notificationDoNotDisturb')?.value !== 'always';
            if (desktopAllowed && setting && setting.desktopNotification.value && Notification.permission === 'granted') {
                const tempEl = document.createElement('div');
                tempEl.innerHTML = strippedMessage ?? message.replace(/<br\s*[/]?>/gi, '\n');
                const msg = tempEl.innerText.replace(/  +/g, ' ');
                const desktopNotification = new Notification(title, {
                    body: msg,
                    icon: image,
                    silent: true,
                });
                setTimeout(() => {
                    desktopNotification.close();
                }, timeout);
            }

            // Check if this type of notification is disabled or held back
            if (inGameDisabled || doNotDisturb) {
                return;
            }

            // Identical notification still on screen: count it up instead of stacking another one
            const existing = Notifier.activeToasts.get(key);
            if (existing && (Settings.getSetting('notificationGrouping')?.value ?? true) && document.getElementById(existing.id)) {
                existing.count++;
                $(`#${existing.id} .notification-count`).text(`×${existing.count}`).removeClass('d-none');
                if (existing.timer) {
                    clearTimeout(existing.timer);
                    existing.timer = setTimeout(() => $(`#${existing.id}`).toast('hide'), timeout);
                }
                return;
            }

            // Get the notification ready to display
            const toastID = Rand.string(7);
            const toastHTML = `<div id="${toastID}" class="toast bg-${NotificationOption[type]}" data-autohide="false">
                ${title ? `<div class="toast-header">
                    ${image ? `<img src="${image}" class="icon" />` : ''}
                    ${pokemonImage ? `<img src="${pokemonImage}" class="pokemonIcon" />` : ''}
                    <strong class="mr-auto text-primary">${title || ''}</strong>
                    <span class="badge badge-pill badge-dark notification-count d-none mr-1"></span>
                    <small class="text-muted">${time}</small>
                    <button type="button" class="ml-2 mb-1 close" data-dismiss="toast">×</button>
                </div>` : ''}
                <div class="toast-body text-light d-flex align-items-center">
                    ${!title && image ? `<img src="${image}" class="icon" />` : ''}
                    ${!title && pokemonImage ? `<img src="${pokemonImage}" class="pokemonIcon" />` : ''}
                    <span class="flex-grow-1">${message.replace(/\n/g, '<br/>')}</span>
                    ${title ? '' : '<span class="badge badge-pill badge-dark notification-count d-none ml-1"></span><button type="button" class="close align-self-start" data-dismiss="toast">×</button>'}
                </div>
                </div>`;

            $('#toaster').prepend(toastHTML);
            const entry: { id: string, count: number, timer?: ReturnType<typeof setTimeout> } = { id: toastID, count: 1 };
            Notifier.activeToasts.set(key, entry);

            // Show the notification
            $(`#${toastID}`)?.toast('show');

            // Once the notification is shown, hide it after specified timeout
            $(`#${toastID}`).on('shown.bs.toast', () => {
                entry.timer = setTimeout(() => {
                    $(`#${toastID}`).toast('hide');
                }, timeout);
            });

            // Once hidden remove the element
            $(`#${toastID}`).on('hidden.bs.toast', () => {
                if (Notifier.activeToasts.get(key)?.id === toastID) {
                    Notifier.activeToasts.delete(key);
                }
                document.getElementById(toastID).remove();
            });
        });
    }

    public static prompt({
        title,
        message,
        type = NotificationOption.primary,
        timeout = 0,
        sound = null,
    }: {
        title: string;
        message: string;
        type?: NotificationOption;
        timeout?: number;
        sound?: Sound,
    }): Promise<string> {
        // If we have sounds enabled for this, play it now
        if (sound) {
            sound.play();
        }

        return new Promise((resolve) => {
            // Get the notification ready to display
            const modalID = Rand.string(7);
            const html = `
<div class="modal fade noselect" id="modal${modalID}" tabindex="-1" role="dialog" aria-badgeledby="prompt">
    <div class="modal-dialog modal-dialog-scrollable modal-sm" role="document">
        <div class="modal-content">
            <div class="modal-header modal-header pb-0 pt-2 px-2 bg-${NotificationOption[type]}">
                <h5>${title}</h5>
                <button id="promptClose${modalID}" type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body py-2 px-2 text-left">
                ${message.replace(/\n/g, '<br/>')}
                <br/>
                <br/>
                <input class="outline-dark form-control" placeholder="Type here.." id="promptInput${modalID}" type="text">
            </div>
            <div class="modal-footer p-2">
                <button class="btn btn-block outline-dark btn-${NotificationOption[type]}" data-dismiss="modal">Submit</button>
            </div>
        </div>
    </div>
</div>`;
            $('#toaster').before(html);

            (document.getElementById(`promptInput${modalID}`) as HTMLInputElement).addEventListener('keyup', ({ key }) => {
                if (key === 'Enter') {
                    $(`#modal${modalID}`).modal('hide');
                }
                if (key === 'Escape') {
                    $(`#promptInput${modalID}`).val('');
                }
            });

            $(`#modal${modalID}`).modal({
                backdrop: 'static',
                show: true,
            });

            // Once the modal is shown, hide it after specified timeout
            $(`#modal${modalID}`).on('shown.bs.modal', () => {
                (document.getElementById(`promptInput${modalID}`) as HTMLInputElement).focus();
                if (timeout > 0) {
                    setTimeout(() => {
                        $(`#modal${modalID}`).modal('hide');
                    }, timeout);
                }
            });

            // Clean the input if the player closes the modal with the X
            (document.getElementById(`promptClose${modalID}`) as HTMLInputElement).addEventListener('click', () => {
                $(`#promptInput${modalID}`).val('');
            });

            // Once hidden remove the element
            $(`#modal${modalID}`).on('hidden.bs.modal', () => {
                const inputEl = document.getElementById(`promptInput${modalID}`) as HTMLInputElement;
                const inputValue = inputEl?.value;
                document.getElementById(`modal${modalID}`).remove();
                resolve(inputValue);
            });

        });
    }

    public static confirm({
        title,
        message,
        confirm = 'Ok',
        cancel = 'Cancel',
        type = NotificationOption.primary,
        timeout = 0,
        sound = null,
    }: {
        title: string;
        message: string;
        confirm?: string;
        cancel?: string;
        type?: NotificationOption;
        timeout?: number;
        sound?: Sound,
    }): Promise<boolean> {
        // If we have sounds enabled for this, play it now
        if (sound) {
            sound.play();
        }

        return new Promise((resolve) => {
            // Get the notification ready to display
            const modalID = Rand.string(7);
            const html = `
<div class="modal fade noselect" id="modal${modalID}" tabindex="-1" role="dialog" aria-badgeledby="prompt">
    <div class="modal-dialog modal-dialog-scrollable modal-sm" role="document">
        <div class="modal-content">
            <div class="modal-header modal-header pb-0 pt-2 px-2 bg-${NotificationOption[type]}">
                <h5>${title}</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body py-2 px-2 text-left">
                ${message.replace(/\n/g, '<br/>')}
            </div>
            <div class="modal-footer p-2">
                <button class="btn col outline-dark btn-${NotificationOption[type]}" data-dismiss="modal" id="modalConfirm${modalID}">${confirm}</button>
                <button class="btn col outline-dark btn-secondary" data-dismiss="modal">${cancel}</button>
            </div>
        </div>
    </div>
</div>`;
            $('#toaster').before(html);

            (document.getElementById(`modalConfirm${modalID}`) as HTMLInputElement).addEventListener('click', () => {
                resolve(true);
            });

            $(`#modal${modalID}`).modal({
                backdrop: 'static',
                show: true,
            });

            // Once the modal is shown, hide it after specified timeout
            $(`#modal${modalID}`).on('shown.bs.modal', () => {
                if (timeout > 0) {
                    setTimeout(() => {
                        $(`#modal${modalID}`).modal('hide');
                    }, timeout);
                }
            });

            // Once hidden remove the element
            $(`#modal${modalID}`).on('hidden.bs.modal', () => {
                document.getElementById(`modal${modalID}`).remove();
                resolve(false);
            });
        });
    }

    public static warning({
        title,
        message,
        confirm = 'I understand',
        type = NotificationOption.primary,
        timeout = 0,
        sound = null,
    }: {
        title: string;
        message: string;
        confirm?: string;
        type?: NotificationOption;
        timeout?: number;
        sound?: Sound,
    }): Promise<boolean> {
        // If we have sounds enabled for this, play it now
        if (sound) {
            sound.play();
        }

        return new Promise((resolve) => {
            // Get the notification ready to display
            const modalID = Rand.string(7);
            const html = `
<div class="modal fade noselect" id="modal${modalID}" tabindex="-1" role="dialog" aria-badgeledby="prompt">
    <div class="modal-dialog modal-dialog-scrollable modal-sm" role="document">
        <div class="modal-content">
            <div class="modal-header modal-header pb-0 pt-2 px-2 bg-${NotificationOption[type]}">
                <h5 class="modal-title">${title}</h5>
            </div>
            <div class="modal-body py-2 px-2 text-left text-center">
                <i class="text-warning">${message.replace(/\n/g, '<br/>')}</i>
            </div>
            <div class="modal-footer p-2">
                <button class="btn col outline-dark btn-${NotificationOption[type]}" data-dismiss="modal" id="modalConfirm${modalID}">${confirm}</button>
            </div>
        </div>
    </div>
</div>`;
            $('#toaster').before(html);

            (document.getElementById(`modalConfirm${modalID}`) as HTMLInputElement).addEventListener('click', () => {
                resolve(true);
            });

            $(`#modal${modalID}`).modal({
                backdrop: 'static',
                show: true,
            });

            // Once the modal is shown, hide it after specified timeout
            $(`#modal${modalID}`).on('shown.bs.modal', () => {
                if (timeout > 0) {
                    setTimeout(() => {
                        $(`#modal${modalID}`).modal('hide');
                    }, timeout);
                }
            });

            // Once hidden remove the element
            $(`#modal${modalID}`).on('hidden.bs.modal', () => {
                document.getElementById(`modal${modalID}`).remove();
                resolve(false);
            });
        });
    }
}
