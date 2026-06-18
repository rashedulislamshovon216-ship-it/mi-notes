export interface EmojiCategory {
  id: string;
  label: string;
  icon: string;
  items: string[];
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  { id: "recent", label: "Recent", icon: "🕒", items: [] },
  {
    id: "smiley", label: "Smileys", icon: "😀",
    items: [
      "😀","😃","😄","😁","😆","🥹","😅","🤣","😂","🙂","🙃","😉","😊","😇",
      "🥰","😍","🤩","😘","😗","☺️","😚","😙","🥲","😋","😛","😜","🤪","😝",
      "🤑","🤗","🫡","🤔","🫣","🤭","🫢","🫠","🤫","🤥","😶","😐","😑","😬",
      "🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🥴","🤢","🤮",
      "🤧","🥵","🥶","😎","🤓","🧐","😕","🫤","😟","🙁","☹️","😮‍💨","😤","😠",
      "😡","🤬","😈","👿","💀","☠️","🤡","👻","👽","🤖","💩","😺","😸","😹",
      "😻","😼","😽","🙀","😿","😾","🫨","🩷","🩵","🫥",
    ],
  },
  {
    id: "love", label: "Love", icon: "❤️",
    items: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","🩷","🩵","💔","❤️‍🔥","❤️‍🩹","💖","💗",
      "💓","💞","💕","💟","💌","💘","💝","💋","😘","🥰","😍","🫶","🤲","💏","💑","👩‍❤️‍👨","💐",
    ],
  },
  {
    id: "cute", label: "Cute", icon: "🐻",
    items: [
      "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐻‍❄️","🐨","🐯","🦁","🐮","🐷","🐽","🐸",
      "🐵","🙈","🙉","🙊","🐒","🐔","🐧","🐦","🐤","🐣","🐥","🦆","🦅","🦉","🦇","🐺",
      "🐗","🐴","🦄","🐝","🪲","🦋","🐌","🐞","🐜","🦟","🦗","🕷","🦂","🐢","🐍","🦎",
      "🦖","🐙","🦑","🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🐊","🌸","💮",
      "🪷","🏵️","🌹","🥀","🌺","🌻","🌼","🌷","🌱","🪴","🌲","🌳","🌴","🌵","🍀","🍄",
      "🌙","⭐","🌟","✨","💫","🌈","☁️","☀️","⛅","🌤️","🌦️","🌧️","⛈️","🌩️","🌨️","❄️",
    ],
  },
  {
    id: "food", label: "Food", icon: "🍔",
    items: [
      "🍎","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅",
      "🥑","🍆","🥔","🥕","🌽","🌶️","🥒","🥬","🥦","🧄","🧅","🍞","🥐","🥖","🥨","🧀",
      "🥚","🍳","🥞","🧇","🥓","🍔","🍟","🍕","🌭","🥪","🌮","🌯","🥙","🥗","🍣","🍱",
      "🍜","🍝","🍛","🍙","🍚","🍘","🍢","🍡","🍧","🍨","🍦","🍩","🍪","🎂","🍰","🧁",
      "🥧","🍫","🍬","🍭","🍮","🍯","🍼","🥛","☕","🍵","🧃","🥤","🧋","🍺","🍷","🍸",
    ],
  },
  {
    id: "activity", label: "Activity", icon: "⚽",
    items: [
      "⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🪀","🏓","🏸","🥊","🥋","🎯",
      "🎮","🕹️","🎲","🧩","🎻","🎸","🎹","🥁","🎷","🎺","🪕","🎤","🎧","🎬","🎨","🎭",
      "📚","✏️","🖌️","🖊️","🚗","🚕","🚙","🚌","🚎","🏎️","✈️","🚀","🛸","⛵","🚢","🏖️",
    ],
  },
  {
    id: "symbols", label: "Symbols", icon: "💯",
    items: [
      "💯","💢","💥","💫","💦","💨","🕳️","💣","💬","🗯️","💭","🔥","⚡","🌟","✅","❌",
      "❗","❓","‼️","⁉️","💲","♻️","🆗","🆒","🆕","🆓","#️⃣","*️⃣","🔞","🚫","☑️","✔️",
      "♥️","♦️","♣️","♠️","🃏","🎴","🀄","🎫","🎟️","🎁","🎀","🎊","🎉","🪅","🪩","🎈",
    ],
  },
  {
    id: "hands", label: "Hands", icon: "👋",
    items: [
      "👋","🤚","🖐️","✋","🖖","🫱","🫲","🫳","🫴","👌","🤌","🤏","✌️","🤞","🫰","🤟",
      "🤘","🤙","👈","👉","👆","🖕","👇","☝️","🫵","👍","👎","✊","👊","🤛","🤜","👏",
      "🙌","🫶","👐","🤲","🤝","🙏","💅","🤳","💪","🦾","🦵","🦿","🦶","👂","🦻","👃",
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
  const next = [e, ...cur].slice(0, 32);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

/** Curated sticker packs — big emoji-as-sticker entries with captions. */
export const STICKER_PACKS: { id: string; name: string; stickers: { id: string; emoji: string; caption: string }[] }[] = [
  {
    id: "moods", name: "Moods ✨",
    stickers: [
      { id: "love",    emoji: "🥰", caption: "miss u" },
      { id: "lol",     emoji: "🤣", caption: "lmaooo" },
      { id: "wow",     emoji: "😱", caption: "no wayy" },
      { id: "cry",     emoji: "🥹", caption: "i'm crying" },
      { id: "sleepy",  emoji: "🥱", caption: "going to bed" },
      { id: "wink",    emoji: "😉", caption: "ofc 😉" },
      { id: "cool",    emoji: "😎", caption: "vibes only" },
      { id: "fire",    emoji: "🔥", caption: "this is fire" },
      { id: "shy",     emoji: "☺️", caption: "stahp it" },
      { id: "blush",   emoji: "🥺", caption: "pwetty pls" },
      { id: "dead",    emoji: "💀", caption: "i can't" },
      { id: "hmm",     emoji: "🤔", caption: "hmmmm" },
    ],
  },
  {
    id: "cute", name: "Cuties 🐻",
    stickers: [
      { id: "bear",   emoji: "🐻", caption: "beary cute" },
      { id: "bunny",  emoji: "🐰", caption: "hop hop" },
      { id: "panda",  emoji: "🐼", caption: "panda hugs" },
      { id: "cat",    emoji: "😺", caption: "mrow" },
      { id: "dog",    emoji: "🐶", caption: "woof!" },
      { id: "fox",    emoji: "🦊", caption: "sneaky" },
      { id: "frog",   emoji: "🐸", caption: "froggy" },
      { id: "ducky",  emoji: "🦆", caption: "quack" },
      { id: "uni",    emoji: "🦄", caption: "magical" },
      { id: "bee",    emoji: "🐝", caption: "buzzin" },
      { id: "owl",    emoji: "🦉", caption: "wise one" },
      { id: "octo",   emoji: "🐙", caption: "octo hug" },
    ],
  },
  {
    id: "love", name: "Love 💖",
    stickers: [
      { id: "heart",  emoji: "💖", caption: "love u" },
      { id: "kiss",   emoji: "😘", caption: "muah" },
      { id: "hug",    emoji: "🫂", caption: "big hug" },
      { id: "flower", emoji: "🌷", caption: "for you" },
      { id: "rose",   emoji: "🌹", caption: "always" },
      { id: "couple", emoji: "💑", caption: "us 💕" },
      { id: "letter", emoji: "💌", caption: "ily letter" },
      { id: "sparkle",emoji: "✨", caption: "you sparkle" },
    ],
  },
  {
    id: "night", name: "Night 🌙",
    stickers: [
      { id: "moon",   emoji: "🌙", caption: "goodnight" },
      { id: "star",   emoji: "⭐", caption: "u shine" },
      { id: "sleep",  emoji: "😴", caption: "zzz" },
      { id: "tea",    emoji: "🍵", caption: "cozy time" },
      { id: "book",   emoji: "📚", caption: "studying" },
      { id: "rainbw", emoji: "🌈", caption: "after the rain" },
      { id: "cloud",  emoji: "☁️", caption: "daydream" },
      { id: "candle", emoji: "🕯️", caption: "warm vibes" },
    ],
  },
  {
    id: "fun", name: "Party 🎉",
    stickers: [
      { id: "party",  emoji: "🥳", caption: "let's gooo" },
      { id: "cake",   emoji: "🎂", caption: "hbd!" },
      { id: "gift",   emoji: "🎁", caption: "surprise!" },
      { id: "music",  emoji: "🎶", caption: "in my era" },
      { id: "dance",  emoji: "💃", caption: "dance off" },
      { id: "pizza",  emoji: "🍕", caption: "feed me" },
      { id: "boba",   emoji: "🧋", caption: "boba time" },
      { id: "trophy", emoji: "🏆", caption: "we won" },
    ],
  },
];

/** Curated GIF library (royalty-free media.tenor.com). */
export const GIF_LIBRARY: { id: string; url: string; tag: string }[] = [
  { id: "g1", url: "https://media.tenor.com/0bX6vTfFK68AAAAj/cat-cute.gif", tag: "cat" },
  { id: "g2", url: "https://media.tenor.com/qOvU0vTLfRgAAAAj/sticker-hi.gif", tag: "hi" },
  { id: "g3", url: "https://media.tenor.com/I7Q6jZxJ-tEAAAAj/love-you.gif", tag: "love" },
  { id: "g4", url: "https://media.tenor.com/Mv-WupBA0VYAAAAj/cute-kawaii.gif", tag: "kawaii" },
  { id: "g5", url: "https://media.tenor.com/wp7gT3mlAFsAAAAj/lol-laugh.gif", tag: "lol" },
  { id: "g6", url: "https://media.tenor.com/zfKw3VuPRGYAAAAj/heart-cute.gif", tag: "heart" },
  { id: "g7", url: "https://media.tenor.com/3l3yU49QzdAAAAAj/cute-hello.gif", tag: "hello" },
  { id: "g8", url: "https://media.tenor.com/HwzeAaFKpHsAAAAj/bear-cute.gif", tag: "bear" },
  { id: "g9", url: "https://media.tenor.com/qX5dPzPCXswAAAAj/thumbs-up.gif", tag: "yes" },
  { id: "g10", url: "https://media.tenor.com/r-DGGnVxQ4MAAAAj/sad-cry.gif", tag: "sad" },
];

/** Quick reaction palette (used for tap-to-react on messages). */
export const REACTIONS = ["❤️","😂","😮","😢","🙏","🔥","👍","🥰"];
