export interface EmojiCategory {
  id: string;
  label: string;
  icon: string;
  items: string[];
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: "recent", label: "Recent", icon: "🕒",
    items: [], // populated at runtime
  },
  {
    id: "smiley", label: "Smileys", icon: "😀",
    items: [
      "😀","😃","😄","😁","😆","🥹","😅","🤣","😂","🙂","🙃","😉","😊","😇",
      "🥰","😍","🤩","😘","😗","☺️","😚","😙","🥲","😋","😛","😜","🤪","😝",
      "🤑","🤗","🫡","🤔","🫣","🤭","🫢","🫠","🤫","🤥","😶","😐","😑","😬",
      "🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🥴","🤢","🤮",
      "🤧","🥵","🥶","😎","🤓","🧐","😕","🫤","😟","🙁","☹️","😮‍💨","😤","😠",
      "😡","🤬","😈","👿","💀","☠️","🤡","👻","👽","🤖","💩",
    ],
  },
  {
    id: "love", label: "Love", icon: "❤️",
    items: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","❤️‍🩹","💖","💗",
      "💓","💞","💕","💟","💌","💘","💝","💋","😘","🥰","😍","🫶","🤲","💏","💑",
    ],
  },
  {
    id: "cute", label: "Cute", icon: "🐻",
    items: [
      "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐻‍❄️","🐨","🐯","🦁","🐮","🐷",
      "🐸","🐵","🐔","🐧","🐦","🐤","🦄","🐝","🪿","🦋","🐢","🐙","🦀","🌸","🌷",
      "🌹","🌺","🌻","🌼","🌱","🍀","🍄","🌙","⭐","✨","💫","🌈","☁️","☀️",
    ],
  },
  {
    id: "food", label: "Food", icon: "🍔",
    items: [
      "🍎","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝",
      "🍅","🥑","🍆","🥔","🥕","🌽","🌶️","🥒","🥬","🥦","🍞","🥐","🥖","🥨","🧀",
      "🥚","🍳","🥞","🧇","🥓","🍔","🍟","🍕","🌭","🥪","🌮","🌯","🥙","🍣","🍱",
      "🍜","🍝","🍦","🍩","🍪","🎂","🍰","🧁","🍫","🍬","🍭","☕","🧋","🍺","🍷","🍸",
    ],
  },
  {
    id: "activity", label: "Activity", icon: "⚽",
    items: [
      "⚽","🏀","🏈","⚾","🎾","🏐","🏉","🎱","🏓","🏸","🥊","🥋","🎯","🎮","🎲",
      "🎻","🎸","🎹","🥁","🎤","🎧","🎬","🎨","🎭","📚","✏️","🚗","✈️","🚀","🛸",
    ],
  },
  {
    id: "symbols", label: "Symbols", icon: "💯",
    items: [
      "💯","💢","💥","💫","💦","💨","🕳️","💣","💬","🗯️","💭","🔥","⚡","🌟","✅",
      "❌","❗","❓","‼️","⁉️","💲","♻️","🆗","🆒","🆕","🆓","#️⃣","*️⃣","🔞","🚫",
    ],
  },
  {
    id: "hands", label: "Hands", icon: "👋",
    items: [
      "👋","🤚","🖐️","✋","🖖","🫱","🫲","🫳","🫴","👌","🤌","🤏","✌️","🤞","🫰",
      "🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","🫵","👍","👎","✊","👊","🤛",
      "🤜","👏","🙌","🫶","👐","🤲","🤝","🙏","💅","🤳","💪","🦾",
    ],
  },
];

const RECENT_KEY = "qn.emoji.recent.v1";

export function getRecentEmojis(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
}
export function pushRecentEmoji(e: string) {
  const cur = getRecentEmojis().filter((x) => x !== e);
  const next = [e, ...cur].slice(0, 28);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

/** Curated sticker pack — large emoji-as-sticker entries with captions. */
export const STICKER_PACKS: { id: string; name: string; stickers: { id: string; emoji: string; caption: string }[] }[] = [
  {
    id: "moods", name: "Moods",
    stickers: [
      { id: "love",    emoji: "🥰", caption: "miss u" },
      { id: "lol",     emoji: "🤣", caption: "lmaooo" },
      { id: "wow",     emoji: "😱", caption: "no wayy" },
      { id: "cry",     emoji: "🥹", caption: "i'm crying" },
      { id: "sleepy",  emoji: "🥱", caption: "going to bed" },
      { id: "wink",    emoji: "😉", caption: "ofc 😉" },
      { id: "cool",    emoji: "😎", caption: "vibes only" },
      { id: "fire",    emoji: "🔥", caption: "this is fire" },
    ],
  },
  {
    id: "cute", name: "Cute",
    stickers: [
      { id: "bear",   emoji: "🐻", caption: "beary cute" },
      { id: "bunny",  emoji: "🐰", caption: "hop hop" },
      { id: "panda",  emoji: "🐼", caption: "panda hugs" },
      { id: "cat",    emoji: "😺", caption: "mrow" },
      { id: "flower", emoji: "🌷", caption: "for you" },
      { id: "star",   emoji: "⭐", caption: "you shine" },
      { id: "moon",   emoji: "🌙", caption: "goodnight" },
      { id: "rain",   emoji: "🌈", caption: "after the rain" },
    ],
  },
];

/** Curated tenor-style GIF URLs (royalty-free media.tenor.com). */
export const GIF_LIBRARY: { id: string; url: string; tag: string }[] = [
  { id: "g1", url: "https://media.tenor.com/0bX6vTfFK68AAAAj/cat-cute.gif", tag: "cat" },
  { id: "g2", url: "https://media.tenor.com/qOvU0vTLfRgAAAAj/sticker-hi.gif", tag: "hi" },
  { id: "g3", url: "https://media.tenor.com/I7Q6jZxJ-tEAAAAj/love-you.gif", tag: "love" },
  { id: "g4", url: "https://media.tenor.com/Mv-WupBA0VYAAAAj/cute-kawaii.gif", tag: "kawaii" },
  { id: "g5", url: "https://media.tenor.com/wp7gT3mlAFsAAAAj/lol-laugh.gif", tag: "lol" },
  { id: "g6", url: "https://media.tenor.com/zfKw3VuPRGYAAAAj/heart-cute.gif", tag: "heart" },
];
