const CHAT_WEBHOOK_URL = 'WebhookURL'; // Webhook URLを入力

const calendarIds = [
  'CalendarID',
  // カレンダーIDを追加
];

const calendarNames = {
  'CalendarID': 'CalendarName',
  // カレンダーIDと名前を追加
};

function onCalendarEvent(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // 最大30秒待機

  try {
    const calendarId = e.calendarId;
    const calendarName = calendarNames[calendarId] || '未設定のカレンダー';
    const myCalendar = CalendarApp.getCalendarById(calendarId);

    // 前回のイベント一覧を取得
    const prevEvents = getPrevEvents(calendarId);

    // 今回のイベント一覧を取得
    const nowEvents = getNowEvents(myCalendar);

    // イベントIDをキーとしたマップを作成
    const prevEventMap = createEventMap(prevEvents);
    const nowEventMap = createEventMap(nowEvents);

    // 変更の検出
    detectChanges(prevEventMap, nowEventMap, calendarName);

    // 今回のイベント一覧を保存
    saveEvents(nowEvents, calendarId);
  } finally {
    lock.releaseLock();
  }
}

function getPrevEvents(calendarId) {
  const properties = PropertiesService.getUserProperties();
  const data = properties.getProperty('events_' + calendarId);
  return data ? JSON.parse(data) : [];
}

function saveEvents(events, calendarId) {
  const properties = PropertiesService.getUserProperties();
  properties.setProperty('events_' + calendarId, JSON.stringify(events));
}

function createEventMap(events) {
  const eventMap = {};
  events.forEach(event => {
    eventMap[event.id] = event;
  });
  return eventMap;
}

function getNowEvents(calendar) {
  const now = new Date();
  const past = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30); // 過去30日
  const future = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365); // 1年後
  const events = calendar.getEvents(past, future);
  return events.map(event => ({
    id: event.getId(),
    title: event.getTitle(),
    startTime: event.getStartTime().getTime(),
    endTime: event.getEndTime().getTime(),
    description: event.getDescription()
  }));
}

function detectChanges(prevEventMap, nowEventMap, calendarName) {
  // イベントの追加と更新の検出
  for (const id in nowEventMap) {
    if (!prevEventMap[id]) {
      // 追加されたイベント
      notifyAddedEvent(nowEventMap[id], calendarName);
    } else if (hasEventChanged(prevEventMap[id], nowEventMap[id])) {
      // 更新されたイベント
      notifyUpdatedEvent(prevEventMap[id], nowEventMap[id], calendarName);
    }
  }

  // 削除されたイベントの検出
  for (const id in prevEventMap) {
    if (!nowEventMap[id]) {
      // 削除されたイベント
      notifyDeletedEvent(prevEventMap[id], calendarName);
    }
  }
}

function hasEventChanged(event1, event2) {
  return event1.title !== event2.title ||
         event1.startTime !== event2.startTime ||
         event1.endTime !== event2.endTime ||
         event1.description !== event2.description;
}

function notifyAddedEvent(event, calendarName) {
  let message = `📅✅ *${event.title}*
${formatDate(event.startTime)} ～
${formatDate(event.endTime)}`;

  if (event.description) {
    message += `\n\n${event.description}`;
  }

  sendChatNotification(message);
}

function notifyUpdatedEvent(prevEvent, event, calendarName) {
  // 基本メッセージの構築
  let message = `📅🔄 *${event.title}*
${formatDate(event.startTime)} ～
${formatDate(event.endTime)}`;

  // 変更後の詳細がある場合のみ追加
  if (event.description) {
    message += `\n\n${event.description}`;
  }

  message += `\n\n↑\n
📅🔄 *${prevEvent.title}*
${formatDate(prevEvent.startTime)} ～
${formatDate(prevEvent.endTime)}`;

  // 変更前の詳細がある場合のみ追加
  if (prevEvent.description) {
    message += `\n\n${prevEvent.description}`;
  }

  sendChatNotification(message);
}


function notifyDeletedEvent(event, calendarName) {
  let message = `📅🗑 *${event.title}*
${formatDate(event.startTime)} ～
${formatDate(event.endTime)}`;

  if (event.description) {
    message += `\n\n${event.description}`;
  }

  sendChatNotification(message);
}


function formatDate(timestamp) {
  return Utilities.formatDate(new Date(timestamp), Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm');
}

function sendChatNotification(message) {
  const payload = JSON.stringify({ text: message });
  const options = {
    method: 'post',
    contentType: 'application/json; charset=UTF-8',
    payload: payload,
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(CHAT_WEBHOOK_URL, options);

  if (response.getResponseCode() !== 200) {
    Logger.log('通知の送信に失敗しました: ' + response.getContentText());
  }
}

