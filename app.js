const STORAGE_KEY = "starpick-state-v1";
const dayNames = ["日", "一", "二", "三", "四", "五", "六"];
const habitEmojis = ["📖", "💧", "🏃", "🧘", "🥗", "🛌", "✍️", "🎧"];
const wishEmojis = ["🎬", "☕", "🎁", "✈️", "🎮", "🍰", "📚", "🌷"];

const todayKey = () => new Date().toISOString().slice(0, 10);
const daysAgoKey = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

function defaultState() {
  return {
    createdAt: new Date().toISOString(),
    stars: 14,
    totalEarned: 28,
    habits: [
      { id: crypto.randomUUID(), name: "喝够 8 杯水", emoji: "💧", reward: 2, days: [0,1,2,3,4,5,6], completions: [daysAgoKey(3), daysAgoKey(2), daysAgoKey(1)] },
      { id: crypto.randomUUID(), name: "阅读 20 分钟", emoji: "📖", reward: 3, days: [1,2,3,4,5], completions: [daysAgoKey(2), daysAgoKey(1)] },
      { id: crypto.randomUUID(), name: "散步或运动", emoji: "🏃", reward: 4, days: [0,2,4,6], completions: [daysAgoKey(4), daysAgoKey(2)] }
    ],
    wishes: [
      { id: crypto.randomUUID(), name: "看一场喜欢的电影", emoji: "🎬", cost: 20, redeemedAt: null },
      { id: crypto.randomUUID(), name: "买一本新书", emoji: "📚", cost: 35, redeemedAt: null },
      { id: crypto.randomUUID(), name: "周末喝一杯奶茶", emoji: "🧋", cost: 12, redeemedAt: new Date(Date.now() - 86400000 * 4).toISOString() }
    ]
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved?.habits && saved?.wishes ? saved : defaultState();
  } catch { return defaultState(); }
}

let state = loadState();
let wishFilter = "active";
let selectedHabitEmoji = habitEmojis[0];
let selectedWishEmoji = wishEmojis[0];
let selectedDays = new Set([0,1,2,3,4,5,6]);
let deferredInstallPrompt;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function isScheduledToday(habit) { return habit.days.includes(new Date().getDay()); }
function isDoneToday(habit) { return habit.completions.includes(todayKey()); }
function todayHabits() { return state.habits.filter(isScheduledToday); }
function totalChecks() { return state.habits.reduce((sum, habit) => sum + habit.completions.length, 0); }

function getStreak(habit) {
  let streak = 0;
  const completed = new Set(habit.completions);
  const cursor = new Date();
  if (!completed.has(todayKey())) cursor.setDate(cursor.getDate() - 1);
  for (let attempts = 0; attempts < 730; attempts += 1) {
    const key = cursor.toISOString().slice(0, 10);
    if (habit.days.includes(cursor.getDay())) {
      if (!completed.has(key)) break;
      streak += 1;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function habitCard(habit, management = false) {
  const done = isDoneToday(habit);
  const streak = getStreak(habit);
  return `<article class="habit-card">
    <div class="habit-icon">${habit.emoji}</div>
    <div class="habit-info"><strong>${escapeHtml(habit.name)}</strong><span><b>★</b> +${habit.reward} · ${streak ? `连续 ${streak} 天` : "从今天开始"}</span></div>
    ${management
      ? `<div class="habit-actions"><button class="icon-button" data-delete-habit="${habit.id}" aria-label="删除习惯">⌫</button></div>`
      : `<button class="check-button ${done ? "done" : ""}" data-check-habit="${habit.id}" aria-label="${done ? "取消打卡" : "完成打卡"}">✓</button>`}
  </article>`;
}

function renderToday() {
  const habits = todayHabits();
  const done = habits.filter(isDoneToday).length;
  const progress = habits.length ? Math.round(done / habits.length * 100) : 0;
  $("#todayHabitList").innerHTML = habits.map((habit) => habitCard(habit)).join("");
  $("#todayEmpty").classList.toggle("hidden", habits.length > 0);
  $("#progressText").textContent = `${done} / ${habits.length}`;
  $("#progressPercent").textContent = `${progress}%`;
  $("#progressRing").style.setProperty("--progress", progress);
  $("#encouragement").textContent = progress === 100 ? "太棒了，今天的星光全部收集完成！" : progress >= 50 ? "已经过半，再坚持一下就完成啦。" : "从一个小小的行动开始吧。";

  const nextWish = state.wishes.filter((wish) => !wish.redeemedAt).sort((a, b) => a.cost - b.cost)[0];
  if (nextWish) {
    $("#nextWishName").textContent = `${nextWish.emoji} ${nextWish.name}`;
    $("#wishProgressBar").style.width = `${Math.min(100, state.stars / nextWish.cost * 100)}%`;
    $("#wishProgressText").textContent = state.stars >= nextWish.cost ? "星星已足够，可以兑换啦" : `还差 ${nextWish.cost - state.stars} 颗星星`;
  } else {
    $("#nextWishName").textContent = "还没有心愿";
    $("#wishProgressBar").style.width = "0%";
    $("#wishProgressText").textContent = "创建一个想兑换的奖励吧";
  }
}

function renderHabits() {
  $("#allHabitList").innerHTML = state.habits.length
    ? state.habits.map((habit) => habitCard(habit, true)).join("")
    : `<div class="empty-state"><div class="empty-illustration">🌱</div><h3>暂无习惯</h3><p>点击右上角开始创建。</p></div>`;
  const lastWeekKeys = Array.from({ length: 7 }, (_, index) => daysAgoKey(index));
  $("#weekCompletions").textContent = state.habits.reduce((sum, habit) => sum + habit.completions.filter((date) => lastWeekKeys.includes(date)).length, 0);
  $("#bestStreak").textContent = Math.max(0, ...state.habits.map(getStreak));
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return date;
  });
  $("#weekStrip").innerHTML = dates.map((date) => {
    const key = date.toISOString().slice(0, 10);
    const hasCheck = state.habits.some((habit) => habit.completions.includes(key));
    return `<div class="week-day ${hasCheck ? "has-check" : ""} ${key === todayKey() ? "today" : ""}"><span>${dayNames[date.getDay()]}</span><b>${date.getDate()}</b></div>`;
  }).join("");
}

function renderWishes() {
  const wishes = state.wishes.filter((wish) => wishFilter === "redeemed" ? wish.redeemedAt : !wish.redeemedAt);
  $("#wishList").innerHTML = wishes.map((wish) => {
    const affordable = state.stars >= wish.cost;
    return `<article class="wish-card ${wish.redeemedAt ? "redeemed" : ""}">
      <button class="delete-wish" data-delete-wish="${wish.id}" aria-label="删除心愿">×</button>
      <div class="wish-emoji">${wish.emoji}</div><strong>${escapeHtml(wish.name)}</strong>
      <div class="wish-cost"><b>★</b>${wish.cost} 颗星星</div>
      ${wish.redeemedAt ? `<button class="redeem-button" disabled>已实现 ✓</button>` : `<button class="redeem-button" data-redeem-wish="${wish.id}" ${affordable ? "" : "disabled"}>${affordable ? "兑换心愿" : `还差 ${wish.cost - state.stars} 颗`}</button>`}
    </article>`;
  }).join("");
  $("#wishEmpty").classList.toggle("hidden", wishes.length > 0);
}

function renderProfile() {
  const joined = Math.max(1, Math.ceil((Date.now() - new Date(state.createdAt).getTime()) / 86400000));
  $("#joinedDays").textContent = `和拾星相伴第 ${joined} 天`;
  $("#totalEarned").textContent = state.totalEarned;
  $("#totalChecks").textContent = totalChecks();
  $("#totalRedeemed").textContent = state.wishes.filter((wish) => wish.redeemedAt).length;
}

function render() {
  $("#starCount").textContent = state.stars;
  $("#walletStars").textContent = state.stars;
  renderToday();
  renderHabits();
  renderWishes();
  renderProfile();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function toggleHabit(id) {
  const habit = state.habits.find((item) => item.id === id);
  if (!habit) return;
  const index = habit.completions.indexOf(todayKey());
  if (index >= 0) {
    habit.completions.splice(index, 1);
    state.stars = Math.max(0, state.stars - habit.reward);
    state.totalEarned = Math.max(0, state.totalEarned - habit.reward);
    showToast(`已取消打卡，收回 ${habit.reward} 颗星星`);
  } else {
    habit.completions.push(todayKey());
    state.stars += habit.reward;
    state.totalEarned += habit.reward;
    showToast(`打卡成功，获得 ${habit.reward} 颗星星 ★`);
  }
  saveState();
}

function redeemWish(id) {
  const wish = state.wishes.find((item) => item.id === id);
  if (!wish || wish.redeemedAt || state.stars < wish.cost) return;
  if (!confirm(`要用 ${wish.cost} 颗星星兑换“${wish.name}”吗？`)) return;
  state.stars -= wish.cost;
  wish.redeemedAt = new Date().toISOString();
  saveState();
  showToast("心愿已实现，记得好好享受！");
}

function navigate(view) {
  $$(".view").forEach((element) => element.classList.toggle("active", element.dataset.view === view));
  $$(".bottom-nav button").forEach((button) => button.classList.toggle("active", button.dataset.nav === view));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function createPicker(container, emojis, selected, onSelect) {
  container.innerHTML = emojis.map((emoji) => `<button type="button" class="${emoji === selected ? "selected" : ""}" data-emoji="${emoji}">${emoji}</button>`).join("");
  container.onclick = (event) => {
    const button = event.target.closest("[data-emoji]");
    if (!button) return;
    onSelect(button.dataset.emoji);
    [...container.children].forEach((item) => item.classList.toggle("selected", item === button));
  };
}

function openModal(type) {
  const isHabit = type === "habit";
  $("#modalTitle").textContent = isHabit ? "创建新习惯" : "添加新心愿";
  $("#habitForm").classList.toggle("hidden", !isHabit);
  $("#wishForm").classList.toggle("hidden", isHabit);
  $("#modalBackdrop").classList.add("open");
  $("#modalBackdrop").setAttribute("aria-hidden", "false");
  setTimeout(() => (isHabit ? $("#habitName") : $("#wishName")).focus(), 200);
}

function closeModal() {
  $("#modalBackdrop").classList.remove("open");
  $("#modalBackdrop").setAttribute("aria-hidden", "true");
}

let toastTimer;
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function initialize() {
  const now = new Date();
  $("#todayLabel").textContent = `${now.getMonth() + 1} 月 ${now.getDate()} 日 · 星期${dayNames[now.getDay()]}`;
  const hour = now.getHours();
  $("#greeting").textContent = hour < 11 ? "早上好，收集今天的星光" : hour < 18 ? "今天也要闪闪发光" : "晚上好，辛苦了一天";

  createPicker($("#habitEmojiPicker"), habitEmojis, selectedHabitEmoji, (emoji) => { selectedHabitEmoji = emoji; });
  createPicker($("#wishEmojiPicker"), wishEmojis, selectedWishEmoji, (emoji) => { selectedWishEmoji = emoji; });
  $("#dayPicker").innerHTML = dayNames.map((name, index) => `<button type="button" class="selected" data-day="${index}">${name}</button>`).join("");

  document.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-nav]");
    const modal = event.target.closest("[data-open-modal]");
    const check = event.target.closest("[data-check-habit]");
    const deleteHabit = event.target.closest("[data-delete-habit]");
    const redeem = event.target.closest("[data-redeem-wish]");
    const deleteWish = event.target.closest("[data-delete-wish]");
    if (nav) navigate(nav.dataset.nav);
    if (modal) openModal(modal.dataset.openModal);
    if (check) toggleHabit(check.dataset.checkHabit);
    if (redeem) redeemWish(redeem.dataset.redeemWish);
    if (deleteHabit && confirm("确定删除这个习惯吗？历史打卡也会删除。")) {
      state.habits = state.habits.filter((habit) => habit.id !== deleteHabit.dataset.deleteHabit); saveState();
    }
    if (deleteWish && confirm("确定删除这个心愿吗？")) {
      state.wishes = state.wishes.filter((wish) => wish.id !== deleteWish.dataset.deleteWish); saveState();
    }
  });

  $("#dayPicker").addEventListener("click", (event) => {
    const button = event.target.closest("[data-day]");
    if (!button) return;
    const day = Number(button.dataset.day);
    if (selectedDays.has(day)) {
      if (selectedDays.size === 1) return showToast("至少选择一天");
      selectedDays.delete(day);
    } else selectedDays.add(day);
    button.classList.toggle("selected", selectedDays.has(day));
  });

  $("#habitForm").addEventListener("submit", (event) => {
    event.preventDefault();
    state.habits.push({ id: crypto.randomUUID(), name: $("#habitName").value.trim(), emoji: selectedHabitEmoji, reward: Number($("#habitReward").value), days: [...selectedDays].sort(), completions: [] });
    event.target.reset(); $("#habitReward").value = 3; closeModal(); saveState(); showToast("新习惯创建成功");
  });
  $("#wishForm").addEventListener("submit", (event) => {
    event.preventDefault();
    state.wishes.push({ id: crypto.randomUUID(), name: $("#wishName").value.trim(), emoji: selectedWishEmoji, cost: Number($("#wishCost").value), redeemedAt: null });
    event.target.reset(); $("#wishCost").value = 30; closeModal(); saveState(); showToast("心愿已放进口袋");
  });
  $("#closeModal").onclick = closeModal;
  $("#modalBackdrop").addEventListener("click", (event) => { if (event.target === $("#modalBackdrop")) closeModal(); });

  $$("[data-wish-filter]").forEach((button) => button.addEventListener("click", () => {
    wishFilter = button.dataset.wishFilter;
    $$("[data-wish-filter]").forEach((item) => item.classList.toggle("active", item === button));
    renderWishes();
  }));

  const isNativeApp = Boolean(window.Capacitor?.isNativePlatform?.());
  if (isNativeApp) {
    $("#openWidget").classList.add("hidden");
  } else {
    $("#openWidget").onclick = () => window.open(`${location.pathname}?widget=1`, "starpick-widget", "width=420,height=290,resizable=yes");
  }
  $("#exportData").onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = `拾星备份-${todayKey()}.json`; link.click(); URL.revokeObjectURL(link.href);
  };
  $("#resetData").onclick = () => { if (confirm("确定恢复示例数据吗？当前数据会被覆盖。")) { state = defaultState(); saveState(); showToast("示例数据已恢复"); } };
  $("#starBalance").onclick = () => navigate("wishes");

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); deferredInstallPrompt = event; $("#installApp").classList.remove("hidden");
  });
  $("#installApp").onclick = async () => { if (deferredInstallPrompt) { deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; $("#installApp").classList.add("hidden"); } };

  if (new URLSearchParams(location.search).has("widget")) document.body.classList.add("widget-mode");
  render();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js");
}

initialize();
