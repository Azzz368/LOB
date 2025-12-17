import * as THREE from 'three';

const scene = new THREE.Scene();
scene.background = null; // 透明场景，由独立的HTML白底层提供背景

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(6, 1.0, 5.5);
camera.lookAt(3.5, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;
document.body.appendChild(renderer.domElement);
renderer.domElement.style.position = 'relative';
renderer.domElement.style.zIndex = '10000';

// 页面底层白色背景（独立层，固定全屏，最底层）
const pageBg = document.createElement('div');
pageBg.style.position = 'fixed';
pageBg.style.inset = '0';
pageBg.style.background = '#ffffff';
pageBg.style.zIndex = '0';
pageBg.style.pointerEvents = 'none';
document.body.appendChild(pageBg);
renderer.domElement.style.position = 'relative';
renderer.domElement.style.zIndex = '9000';

// 背景音乐：展览无需，已移除

// 自适应取景锚点（保持当前构图比例）
let compositionTargetOffset = new THREE.Vector3();
let initialViewDir = new THREE.Vector3();
// 预加载遮罩
const loadingOverlay = document.createElement('div');
loadingOverlay.style.position = 'fixed';
loadingOverlay.style.inset = '0';
loadingOverlay.style.background = '#ffffff';
loadingOverlay.style.display = 'flex';
loadingOverlay.style.alignItems = 'center';
loadingOverlay.style.justifyContent = 'center';
loadingOverlay.style.fontFamily = '"Sitka", serif';
loadingOverlay.style.fontSize = '24px';
loadingOverlay.style.color = '#000';
loadingOverlay.style.zIndex = '9999';
loadingOverlay.textContent = 'Loading…';
document.body.appendChild(loadingOverlay);
// 悬停触发区域（顶部/底部）
const hoverTop = document.createElement('div');
hoverTop.style.position = 'fixed';
hoverTop.style.left = '0';
hoverTop.style.right = '0';
hoverTop.style.top = '0';
hoverTop.style.height = '20vh';
hoverTop.style.zIndex = '9998';
hoverTop.style.pointerEvents = 'auto';
hoverTop.style.background = 'transparent';
document.body.appendChild(hoverTop);

const hoverBottom = document.createElement('div');
hoverBottom.style.position = 'fixed';
hoverBottom.style.left = '0';
hoverBottom.style.right = '0';
hoverBottom.style.bottom = '0';
hoverBottom.style.height = '20vh';
hoverBottom.style.zIndex = '9998';
hoverBottom.style.pointerEvents = 'auto';
hoverBottom.style.background = 'transparent';
document.body.appendChild(hoverBottom);


const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
directionalLight.position.set(5, 10, 5);
scene.add(directionalLight);

// 源文本库（用于点击后在左侧展示对应诗句）
let poemSource = `I have gone marking the atlas of your bodywith crosses of fire.

My mouth went across:a spider trying to hide.In you, behind you, timid, driven by thirst.

Stories to tell you on the shore of the evening,sad and gentle doll, so that you should not be sad.

A swan, a tree,something far away and happy.The season of grapes, the ripe and fruitful season.

I who lived in a harbour from which I loved you.The solitude crossed with dream and with silence.

Penned up between the sea and sadness.Soundless, delirious, between two motionless gondoliers.

Between the lips and the voice something goes dying.

Something with the wings of a bird, something of anguish and oblivion.The way nets cannot hold water.

My toy doll, only a few drops are left trembling.

Even so,something sings in these fugitive words.

Something sings, something climbs to myravenous outh.
Oh to be able to celebrate you with all the words of joy.

Sing,burn, flee,like abelfry at the hands of a madman.
My sad tenderness,what comes over you all at once?

When I have reached the most awesome and the coldest summit,my heart closes like a nocturnal flower.

The memory of you emerges from the night around me.
The river mingles its stubborn lament with the sea.

Deserted like the dwarves at dawn.
It is the hour of departure, oh deserted one!

Cold flower heads are raining over my heart.
Oh pit of debris, fierce cave of the shipwrecked.

In you the wars and the flights accumulated.
From you the wings of the song birds rose.

You swallowed everything, like distance.
Like the sea, like time. In you everything sank!

It was the happy hour of assault and the kiss.
The hour of the spell that blazed like a lighthouse.

Pilot's dread, fury of blind driver,
turbulent drunkenness of love, in you everything sank!

In the childhood of mist my soul, winged and wounded.
Lost discoverer, in you everything sank!

You girdled sorrow, you clung to desire,
sadness stunned you, in you everything sank!

I made the wall of shadow draw back,
beyond desire and act, I walked on.

Oh flesh, my own flesh, woman whom I loved and lost,
I summon you in the moist hour, I raise my song to you.

Leaning into the afternoons I cast my sad nets towards your oceanic eyes.

There in the highest blaze my solitude lengthens and flames, its arms turning like a drowning man's.

I sent out red signals across your absent eyes that move like the sea near a lighthouse.

You keep only darkness, my distant female, from your regard sometimes the coast of dread emerges.

Leaning into the afternoons I fling my sad nets to the sea that beats on your marine eyes.

The birds peck at the first stars that flash like my soul when I love you.

The night on its shadowy mare shedding blue tassels over the land.`;
let poemLines = poemSource.split('\n').filter(l => l.trim().length > 0);
// 与 poemLines 对齐的分组ID（初始为 base）用于断句边界（同一提交/发布时间作为一组）
let lineGroups = new Array(poemLines.length).fill('base');

// 中文翻译映射
const translationMap = {
  "I have gone marking the atlas of your bodywith crosses of fire.": "我以火的十字在你身体的地图上烙下印记离去。",
  "My mouth went across:a spider trying to hide.In you, behind you, timid, driven by thirst.": "我的嘴穿过，像一只蜘蛛，试著藏躲。在你体内、在你身後，畏怯的，被渴求驱使。",
  "Stories to tell you on the shore of the evening,sad and gentle doll, so that you should not be sad.": "在暮色的沙滩上有好多的故事要告诉你，哀伤而温驯的娃娃，你不会再哀伤了。",
  "A swan, a tree,something far away and happy.The season of grapes, the ripe and fruitful season.": "一只天鹅，一棵树，某些远离并令人快乐的事物。葡萄的季节，收割与丰收的季节。",
  "I who lived in a harbour from which I loved you.The solitude crossed with dream and with silence.": "我是住在海港并爱你的人。孤寂被梦和沈默穿过。",
  "Penned up between the sea and sadness.Soundless, delirious, between two motionless gondoliers.": "在海与哀伤之间被囚禁。无声的，谵语的，在两个不动的船夫之间。。",
  "Between the lips and the voice something goes dying.": "在双唇与声音之间的某些事物逝去。",
  "Something with the wings of a bird, something of anguish and oblivion.The way nets cannot hold water.": "鸟的双翼的某些事物，苦痛与遗忘的某些事物。如同网无法握住水一样。",
  "My toy doll, only a few drops are left trembling.": "我的娃娃，仅剩下少量的水滴在颤抖了。",
  "Even so,something sings in these fugitive words.": "即使这样，仍有某些事物在无常的话语中歌唱。",
  "Something sings, something climbs to myravenous outh.": "某些事物歌唱，某些爬上我渴求的嘴的事物。",
  "Oh to be able to celebrate you with all the words of joy.": "啊，要以全部的欢乐的话语才能歌颂你。",
  "Sing,burn, flee,like abelfry at the hands of a madman.": "歌唱，焚烧，逃逸，像一个疯子手中的钟楼。",
  "My sad tenderness,what comes over you all at once?": "我哀伤的温柔，突然涌上你身上的是什么?",
  "When I have reached the most awesome and the coldest summit,my heart closes like a nocturnal flower.": "当我到达最寒冷与庄严的天顶，我的心，如黑夜中的花朵般敛闭。",
  "The memory of you emerges from the night around me.": "与你相关的记忆自围绕我的夜色中浮现",
  "The river mingles its stubborn lament with the sea.": "河流将他最冥顽的哀叹抛向大海",
  "Deserted like the dwarves at dawn.": "像黎明的码头那样被抛弃。",
  "It is the hour of departure, oh deserted one!": "是出发的时刻了，被抛弃的人啊！",
  "Cold flower heads are raining over my heart.": "冰冷的花冠雨点般落在我心上。",
  "Oh pit of debris, fierce cave of the shipwrecked.": "啊，瓦砾的坑，沉船的残酷洞穴。",
  "In you the wars and the flights accumulated.": "在你那里战争和飞行递增。",
  "From you the wings of the song birds rose.": "从那里鸣鸟拍翼而起。",
  "You swallowed everything, like distance.": "你吞并一切，像远方。",
  "Like the sea, like time. In you everything sank!": "像大海，像时间。所有的一切在你身上沈没！",
  "It was the happy hour of assault and the kiss.": "这是突袭与亲吻的幸福时刻。",
  "The hour of the spell that blazed like a lighthouse.": "这迷魅的时刻像灯塔一样燃烧。",
  "Pilot's dread, fury of blind driver,": "飞行员的惊怖、盲潜水夫的狂怒，",
  "turbulent drunkenness of love, in you everything sank!": "激狂的爱的迷醉，所有的一切在你身上沈没！",
  "In the childhood of mist my soul, winged and wounded.": "在迷雾的童年之中，我的灵魂张开翅膀并且受伤。",
  "Lost discoverer, in you everything sank!": "迷失方向的探险者，所有的一切在你身上沈没！",
  "You girdled sorrow, you clung to desire,": "你围捆哀伤，你迷恋欲望，",
  "sadness stunned you, in you everything sank!": "悲哀令你茫然若失，所有的一切在你身上沈没！",
  "I made the wall of shadow draw back,": "我让影子的墙隐没，",
  "beyond desire and act, I walked on.": "越过欲望与行动，我走着。",
  "Oh flesh, my own flesh, woman whom I loved and lost,": "啊肉，我自身的肉，我爱过而又失去的女人。",
  "I summon you in the moist hour, I raise my song to you.": "在潮湿的时刻，我呼唤你，我向你唱起我的歌。",
  "Leaning into the afternoons I cast my sad nets towards your oceanic eyes.": "倚身在暮色里，我朝你海洋般的双眼投掷我哀伤的网。",
  "There in the highest blaze my solitude lengthens and flames, its arms turning like a drowning man's.": "我的孤独，在极度的光亮中绵延不绝，化为火焰，双臂漫天飞舞仿佛将遭海难淹没。",
  "I sent out red signals across your absent eyes that move like the sea near a lighthouse.": "越过你失神的双眼，我送出红色的信号，你的双眼泛起涟漪，如靠近灯塔的海洋。",
  "You keep only darkness, my distant female, from your regard sometimes the coast of dread emerges.": "你保有黑暗，我远方的女子，在你的注视之下有时恐惧的海岸浮现。",
  "Leaning into the afternoons I fling my sad nets to the sea that beats on your marine eyes.": "倚身在暮色，在拍打你海洋般双眼的海上，我掷出我哀伤的网。",
  "The birds peck at the first stars that flash like my soul when I love you.": "夜晚的鸟群啄食第一阵群星，像爱著你的我的灵魂，闪烁著。",
  "The night on its shadowy mare shedding blue tassels over the land.": "夜在年阴郁的马上奔驰，在大地上撒下蓝色的穗须。",
};

// 文字全局缩放系数（不影响转筒文字），用于UI与弹出诗句
let uiFontScale = 1.1; // 你可以改它来整体放大/缩小除转筒外的文字

// 左侧诗句面板（作为容器）
const quotePanel = document.createElement('div');
quotePanel.style.position = 'fixed';
quotePanel.style.left = '0';
quotePanel.style.top = '0';
quotePanel.style.bottom = '0';
quotePanel.style.width = '450px';
quotePanel.style.background = '#ffffff';
quotePanel.style.zIndex = '100';
quotePanel.style.overflow = 'hidden'; // 隐藏溢出内容
document.body.appendChild(quotePanel);

// 创建随机位置的诗句元素（带淡入淡出效果）
function displayQuoteAtRandomPosition(text, zhOverride) {
  // 淡出旧内容
  const oldElements = quotePanel.querySelectorAll('.quote-text');
  oldElements.forEach(el => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 1200); // 1.2s后移除（与过渡一致）
  });
  
  // 创建容器（包含英文和中文）
  const quoteContainer = document.createElement('div');
  quoteContainer.className = 'quote-text';
  quoteContainer.style.position = 'absolute';
  quoteContainer.style.maxWidth = '450px';
  quoteContainer.style.opacity = '0';
  quoteContainer.style.transition = 'opacity 1.2s ease-in-out';
  quoteContainer.style.willChange = 'opacity';
  
  // 英文诗句
  const englishElement = document.createElement('div');
  englishElement.style.fontFamily = '"Sitka", serif';
  englishElement.style.fontSize = (20 * uiFontScale) + 'px';
  englishElement.style.fontWeight = '700';
  englishElement.style.color = '#000';
  englishElement.style.textAlign = 'left';
  englishElement.style.lineHeight = '1.35';
  englishElement.style.marginBottom = '8px';
  // 支持用户提交的换行：\n 按行显示
  englishElement.style.whiteSpace = 'pre-line';
  englishElement.style.wordBreak = 'break-word';
  englishElement.textContent = text;
  
  // 中文翻译
  const chineseElement = document.createElement('div');
  chineseElement.style.fontFamily = 'SimSun, "宋体", serif';
  chineseElement.style.fontSize = (16 * uiFontScale) + 'px';
  chineseElement.style.fontWeight = '400';
  chineseElement.style.color = '#999999';
  chineseElement.style.textAlign = 'left';
  chineseElement.style.lineHeight = '1.5';
  // 支持用户提交的换行：\n 按行显示
  chineseElement.style.whiteSpace = 'pre-line';
  chineseElement.style.wordBreak = 'break-word';
  const translation = (typeof zhOverride === 'string' && zhOverride)
    ? zhOverride
    : (translationMap[text] || '');
  chineseElement.textContent = translation;
  
  quoteContainer.appendChild(englishElement);
  if (translation) {
    quoteContainer.appendChild(chineseElement);
  }
  
  // x坐标：面板中线 ± 50px
  const centerX = 175; 
  const randomX = centerX + (Math.random() * 100 - 50); 
  
  // y坐标：上半部分随机
  const maxY = window.innerHeight * 0.5;
  const isMultiline = typeof text === 'string' && text.indexOf('\n') !== -1;
  // 多行诗句尽量从更靠上的位置开始，避免“看起来被裁掉/切割”
  const randomY = isMultiline ? 60 : (Math.random() * Math.max(0, maxY - 100));
  
  quoteContainer.style.left = `${randomX}px`;
  quoteContainer.style.top = `${randomY}px`;
  
  quotePanel.appendChild(quoteContainer);
  
  // 触发淡入动画（双RAF更稳妥，确保浏览器完成插入/样式计算）
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      quoteContainer.style.opacity = '1';
    });
  });
}

// 简单归一化匹配：按词匹配所在诗句
function normalizeTokens(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
}
// 断句终止符：英语/中文的句号、分号、问号、感叹号
const END_PUNCT = /[.;?!？！。]\s*$/;
function findIndexForWord(word) {
  const target = word.toLowerCase();
  for (let i = 0; i < poemLines.length; i++) {
    const tokens = normalizeTokens(poemLines[i]);
    if (tokens.includes(target)) return i;
  }
  for (let i = 0; i < poemLines.length; i++) {
    if (poemLines[i].toLowerCase().indexOf(target) !== -1) return i;
  }
  return -1;
}

// 从起始行向前拼接完整句子，直到遇到以 ';' 或 '.' 结尾的行
function assembleSentenceFromIndex(startIdx) {
  if (startIdx < 0 || startIdx >= poemLines.length) {
    return { en: '', zh: '' };
  }
  const groupId = lineGroups[startIdx];
  const enParts = [];
  const zhParts = [];
  for (let j = startIdx; j < poemLines.length; j++) {
    if (lineGroups[j] !== groupId) break; // 组边界，不与下一次提交混拼
    const line = poemLines[j];
    enParts.push(line);
    // 行级翻译优先：精确匹配或去掉末尾标点再匹配
    const trimmedEnd = line.replace(END_PUNCT, '');
    if (translationMap[line]) {
      zhParts.push(translationMap[line]);
    } else if (translationMap[trimmedEnd]) {
      zhParts.push(translationMap[trimmedEnd]);
    }
    if (END_PUNCT.test(line)) break;
  }
  const enSentence = enParts.join(' ');
  // 句级翻译次之：整句匹配（含与不含末尾标点）
  let zhSentence = '';
  if (zhParts.length) {
    zhSentence = zhParts.join(' ');
  } else {
    const enTrimmed = enSentence.trim();
    const enNoEnd = enTrimmed.replace(END_PUNCT, '');
    if (translationMap[enTrimmed]) zhSentence = translationMap[enTrimmed];
    else if (translationMap[enNoEnd]) zhSentence = translationMap[enNoEnd];
  }
  return { en: enSentence, zh: zhSentence };
}

function findExtendedSentenceForWord(word) {
  const idx = findIndexForWord(word);
  if (idx === -1) {
    return { en: word, zh: '' };
  }
  return assembleSentenceFromIndex(idx);
}

const poemText = `Leaning into the afternoons I cast my sad nets towards your oceanic eyes.
There in the highest blaze my solitude lengthens and flames, its arms turning like a drowning man's.
I sent out red signals across your absent eyes that move like the sea near a lighthouse.
You keep only darkness, my distant female, from your regard sometimes the coast of dread emerges.
Leaning into the afternoons I fling my sad nets to the sea that beats on your marine eyes.
The birds peck at the first stars that flash like my soul when I love you.
The night on its shadowy mare shedding blue tassels over the land.
The memory of you emerges from the night around me.
The river mingles its stubborn lament with the sea.
Deserted like the dwarves at dawn.
It is the hour of departure, oh deserted one!
Cold flower heads are raining over my heart.
Oh pit of debris, fierce cave of the shipwrecked.
In you the wars and the flights accumulated.
From you the wings of the song birds rose.
You swallowed everything, like distance.
Like the sea, like time. In you everything sank!
It was the happy hour of assault and the kiss.
The hour of the spell that blazed like a lighthouse.
Pilot's dread, fury of blind driver,
turbulent drunkenness of love, in you everything sank!
In the childhood of mist my soul, winged and wounded.
Lost discoverer, in you everything sank!
You girdled sorrow, you clung to desire,
sadness stunned you, in you everything sank!
I made the wall of shadow draw back,
beyond desire and act, I walked on.
Oh flesh, my own flesh, woman whom I loved and lost,
I summon you in the moist hour, I raise my song to you.
I have gone marking the atlas of your bodywith crosses of fire.
My mouth went across:a spider trying to hide.
In you, behind you, timid, driven by thirst.
Stories to tell you on the shore of the evening,sad and gentle doll, 
so that you should not be sad.A swan, a tree,something far away and happy.
The season of grapes, the ripe and fruitful season.
I who lived in a harbour from which I loved you.
The solitude crossed with dream and with silence.
Penned up between the sea and sadness.
Soundless, delirious, between two motionless gondoliers.
Between the lips and the voice something goes dying.
Something with the wings of a bird, something of anguish and oblivion.
The way nets cannot hold water.
My toy doll, only a few drops are left trembling.
Even so,something sings in these fugitive words.
Something sings, something climbs to myravenous outh.
Oh to be able to celebrate you with all the words of joy.
Sing,burn, flee,like abelfry at the hands of a madman.
My sad tenderness,what comes over you all at once?
When I have reached the most awesome and the coldest summitmy heart closes like a nocturnal flower.
`
;


const tiltGroup = new THREE.Group();
tiltGroup.position.x = 5.5; 
tiltGroup.rotation.z = -THREE.MathUtils.degToRad(35);
scene.add(tiltGroup);

// 可调：转筒“基点（pivot）”与缩放系数（uniform scale）
let userScale = 4.0; // 你可以改这个数值控制整体大小（>0）
let userHorizontalOffset = -5.0; // 新增：整体水平偏移（世界单位，正值向右，负值向左）
const userPivot = new THREE.Vector3(0, 0, 0); // 你可以改这里的坐标作为缩放基点

// 通过 pivotGroup 实现围绕任意基点缩放
const pivotGroup = new THREE.Group();
tiltGroup.add(pivotGroup);

const drumGroup = new THREE.Group();
pivotGroup.add(drumGroup);

// 记录未动画的基准位移（用于保持 pivot 偏移）
const drumBasePosition = new THREE.Vector3();

function applyUserPivotAndScale() {
  // pivotGroup 放在基点位置，并对其统一缩放
  pivotGroup.position.copy(userPivot);
  pivotGroup.scale.setScalar(Math.max(0.1, userScale));
  // drumGroup 向反方向平移同样的偏移，确保未缩放时视觉不变
  drumBasePosition.copy(userPivot).multiplyScalar(-1);
  drumGroup.position.copy(drumBasePosition);
}

// 如果需要在控制台临时调参：
// window.setDrumScale(1.2); window.setDrumPivot(0, 2, 0)
window.setDrumScale = function (scale) {
  userScale = Number(scale) || 3;
  applyUserPivotAndScale();
  // 缩放只改变视觉大小，不重置构图锚点
  updateResponsiveFraming();
};
window.setDrumPivot = function (x, y, z) {
  userPivot.set(Number(x) || 0, Number(y) || 0, Number(z) || 0);
  applyUserPivotAndScale();
  // 重新锚定，反映新的枢轴点
  setupFramingAnchors();
  updateResponsiveFraming();
};
// 新：设置水平偏移
window.setDrumOffsetX = function (x) {
  userHorizontalOffset = Number(x) || 0;
  updateResponsiveFraming();
};

// 全局与背景Z轴偏移（用于整体下压平面或单独下压背景）
let globalZOffset = 6.0; // 负值=向远处（下方）推
let bgZOffset = 3.0;     // 仅背景额外偏移
window.setGlobalZOffset = function (z) {
  globalZOffset = Number(z) || 0.0;
  tiltGroup.position.z = globalZOffset;
  updateResponsiveFraming();
};
window.setBgZOffset = function (z) {
  bgZOffset = Number(z) || 0.0;
};

// 初始不立即应用，等锚定后再应用（确保pivot/scale对构图产生预期影响）

// 存储每个单词的布局，用于交互
let wordBoxes = [];
let baseCanvasWidth = 0;
let baseCanvasHeight = 0;
let baseFontSize = 256;
let baseLineHeight = Math.floor(baseFontSize * 1.0);

function createTextCanvas(text) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  // 高分辨率画布
  canvas.width = 8192;
  canvas.height = 4096;
  baseCanvasWidth = canvas.width;
  baseCanvasHeight = canvas.height;
  baseFontSize = 256;
  baseLineHeight = Math.floor(baseFontSize * 1.0);
  
  // 透明背景，黑色Sitka字体
  context.fillStyle = 'black';
  context.font = `${baseFontSize}px "Sitka", serif`;
  context.textAlign = 'left';
  context.textBaseline = 'top';
  
  // 行高与边距（移除上下边距，仅保留极小左右边距）
  const paddingX = 20;
  const paddingRight = 20;
  const lineHeight = baseLineHeight;
  const maxLineWidth = canvas.width - paddingX - paddingRight;
  
  // 连续排版填充（记录所有单词位置）
  wordBoxes = [];
  const words = text.split(/\s+/).filter(w => w.length > 0);
  let wordIndex = 0;
  
  // 从负一行开始，到超出一行结束，确保垂直无缝
  const startY = -lineHeight;
  const endY = canvas.height + lineHeight;
  for (let y = startY; y <= endY; y += lineHeight) {
    let currentLine = '';
    const lineWords = [];
    const lineWordsWithSpace = [];
    // 先装配一行（直到宽度上限）
    while (true) {
      const nextWord = words[wordIndex];
      const tentative = currentLine + (currentLine ? ' ' : '') + nextWord;
      const width = context.measureText(tentative).width;
      if (width <= maxLineWidth) {
        currentLine = tentative;
        lineWords.push(nextWord);
        lineWordsWithSpace.push(nextWord + ' ');
        wordIndex = (wordIndex + 1) % words.length;
      } else {
        if (!currentLine) {
          // 极端超宽单词：强制放入一行
          lineWords.push(nextWord);
          lineWordsWithSpace.push(nextWord + ' ');
          wordIndex = (wordIndex + 1) % words.length;
        }
        break;
      }
    }
    
    // 逐词绘制并记录边界
    let cursorX = paddingX;
    for (let i = 0; i < lineWords.length; i++) {
      const w = lineWords[i];
      const wordWidth = context.measureText(w).width;
      const spaceWidth = context.measureText(' ').width;
      // 绘制单词
      context.fillText(w, cursorX, y);
      // 仅记录落入 [0, canvas.height) 可见区的单词框（用于交互）
      const yVis = y; // 顶部对齐
      if (yVis + lineHeight > 0 && yVis < canvas.height) {
        wordBoxes.push({
          x: cursorX,
          y: yVis,
          w: wordWidth,
          h: lineHeight,
          text: w
        });
      }
      cursorX += wordWidth + spaceWidth;
    }
  }
  
  return canvas;
}


const textCanvas = createTextCanvas(poemText);
let texture = new THREE.CanvasTexture(textCanvas);
texture.wrapS = THREE.RepeatWrapping;
texture.wrapT = THREE.RepeatWrapping;
texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
texture.generateMipmaps = true;
texture.minFilter = THREE.LinearMipmapLinearFilter;
texture.magFilter = THREE.LinearFilter;
texture.colorSpace = THREE.SRGBColorSpace;
texture.needsUpdate = true;
texture.repeat.set(1, 6);

const radius = 1.75;
const height = 20.0;
const segments = 128;

const cylinderGeometry = new THREE.CylinderGeometry(
  radius,
  radius,
  height,
  segments,
  1,
  true 
);

const cylinderMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  map: texture,
  side: THREE.DoubleSide,
    transparent: true,
  alphaTest: 0.1,
    depthWrite: false,
  roughness: 0.8,
  metalness: 0.0
});

const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);

cylinder.castShadow = false;
scene.add(cylinder); 


drumGroup.add(cylinder);

// 初始化自适应取景锚点：保持当前构图不变，仅按屏幕调整距离
function setupFramingAnchors() {
  tiltGroup.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(drumGroup);
  const center = box.getCenter(new THREE.Vector3());
  const currentTarget = new THREE.Vector3(3.5, 0, 0);
  compositionTargetOffset.copy(currentTarget.clone().sub(center));
  initialViewDir.copy(camera.position.clone().sub(currentTarget)).normalize();
}

// 覆盖层：用于绘制中灰色的非悬停单词
const overlayCanvas = document.createElement('canvas');
overlayCanvas.width = baseCanvasWidth / 2;
overlayCanvas.height = baseCanvasHeight / 2;
const overlayCtx = overlayCanvas.getContext('2d');
let overlayTexture = new THREE.CanvasTexture(overlayCanvas);
overlayTexture.wrapS = THREE.RepeatWrapping;
overlayTexture.wrapT = THREE.RepeatWrapping;
overlayTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
overlayTexture.generateMipmaps = true;
overlayTexture.minFilter = THREE.LinearMipmapLinearFilter;
overlayTexture.magFilter = THREE.LinearFilter;
overlayTexture.colorSpace = THREE.SRGBColorSpace;

const overlayMaterial = new THREE.MeshBasicMaterial({
  map: overlayTexture,
      transparent: true,
  side: THREE.DoubleSide,
      depthWrite: false,
  opacity: 1.0
});
const overlayCylinder = new THREE.Mesh(
  new THREE.CylinderGeometry(radius + 0.001, radius + 0.001, height, segments, 1, true),
  overlayMaterial
);
drumGroup.add(overlayCylinder);

// 视觉焦点带（已移除）：采用覆盖层变淡的方式替代

// 确保覆盖层画布尺寸与主文本画布保持匹配（按1/2缩放）
function initOrResizeOverlay() {
  const w = Math.max(2, Math.floor(baseCanvasWidth / 2));
  const h = Math.max(2, Math.floor(baseCanvasHeight / 2));
  if (overlayCanvas.width !== w || overlayCanvas.height !== h) {
    overlayCanvas.width = w;
    overlayCanvas.height = h;
    overlayTexture.needsUpdate = true;
  }
}
// 初始化覆盖层尺寸（此时 baseCanvasWidth/Height 已就绪）
initOrResizeOverlay();

// 背景柱体：在主柱体后方创建多根远处的柱体，旋转与主柱体一致，垂直滚动联动但方向/速度不同
const bgCylinders = [];
// 背景柱体左右位置的“0-100”参数映射（默认11根）
// 按需求在“最左侧第1与第3根之间”插入两根：选用 11 与 19 作为默认插入值
let bgXPercent = [8, 11, 15, 19, 23, 32, 40, 55, 68, 80, 92]; // 可用 setBgXPercent 调整
// 将范围拓展为覆盖整个画布可见区域的更宽世界坐标（左右均可分布，不局限右半屏）
let bgXRange = { min: -40.0, max: 40.0 };
function percentToBgX(pct) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  return bgXRange.min + (bgXRange.max - bgXRange.min) * (p / 100);
}
function createBackgroundCylinders() {
  // 根组：跟随倾斜，但不参与pivot缩放（作为远景背景）
  const bgRoot = new THREE.Group();
  tiltGroup.add(bgRoot);
  
  // 使用更长的柱体几何体：至少是当前柱体长度的3倍（避免看到顶/底）
  const backgroundHeight = height * 4.0;
  const bgCylinderGeometry = new THREE.CylinderGeometry(
    radius,
    radius,
    backgroundHeight,
    segments,
    1,
    true
  );
  
  // 使用当前贴图的快照（不随后续前端内容更新）
  // 为了让每个背景柱体拥有独立的偏移/滚动，给每个柱体克隆一个纹理对象
  const baseRepeat = texture ? texture.repeat.clone() : new THREE.Vector2(1, 6);
  const baseOffset = texture ? texture.offset.clone() : new THREE.Vector2(0, 0);
  // 关键：按高度比例复制贴图，避免拉伸（只用重复，不改变字形比例）
  const tileFactorY = backgroundHeight / height; // 例如4倍高度则纵向重复4倍
  
  // 预设不同的空间分布与滚动方向/速度（相对简单可调）
  // 11 根分布：使用 0-100 映射控制左右位置，新增两根插入最左侧第1与第3根之间
  const presets = [
    { percent: bgXPercent[0]  ?? 8,   dz: -12, dy:  0.0,  scrollDir: +1, speedFactor: 0.55 },
    { percent: bgXPercent[1]  ?? 11,  dz: -15, dy:  0.3,  scrollDir: -1, speedFactor: 0.95 }, // 新增
    { percent: bgXPercent[2]  ?? 15,  dz: -18, dy:  0.6,  scrollDir: -1, speedFactor: 1.25 },
    { percent: bgXPercent[3]  ?? 19,  dz: -20, dy: -0.2,  scrollDir: +1, speedFactor: 0.65 }, // 新增
    { percent: bgXPercent[4]  ?? 23,  dz: -22, dy: -0.6,  scrollDir: +1, speedFactor: 0.75 },
    { percent: bgXPercent[5]  ?? 32,  dz: -26, dy:  1.2,  scrollDir: -1, speedFactor: 2.10 },
    { percent: bgXPercent[6]  ?? 40,  dz: -30, dy: -1.0,  scrollDir: +1, speedFactor: 0.45 },
    { percent: bgXPercent[7]  ?? 55,  dz: -36, dy:  1.4,  scrollDir: -1, speedFactor: 1.35 },
    { percent: bgXPercent[8]  ?? 68,  dz: -42, dy: -1.4,  scrollDir: +1, speedFactor: 0.95 },
    { percent: bgXPercent[9]  ?? 80,  dz: -48, dy:  1.8,  scrollDir: -1, speedFactor: 2.85 },
    { percent: bgXPercent[10] ?? 92,  dz: -56, dy: -1.8,  scrollDir: +1, speedFactor: 0.65 },
  ];
  
  for (let i = 0; i < presets.length; i++) {
    const cfg = presets[i];
    const dx = percentToBgX(cfg.percent);
    
    // 为每个背景柱体单独克隆纹理对象（冻结为当前画面）
    const bgTex = texture ? texture.clone() : null;
    if (bgTex) {
      bgTex.needsUpdate = true;
      bgTex.wrapS = THREE.RepeatWrapping;
      bgTex.wrapT = THREE.RepeatWrapping;
      bgTex.minFilter = THREE.LinearMipmapLinearFilter;
      bgTex.magFilter = THREE.LinearFilter;
      bgTex.colorSpace = THREE.SRGBColorSpace;
      bgTex.offset.copy(baseOffset);
      // 纵向重复倍数，按背景几何高度复制贴图，避免被拉伸
      bgTex.repeat.set(baseRepeat.x, (baseRepeat.y || 1) * tileFactorY);
    }
    
    const bgMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: bgTex,
      side: THREE.DoubleSide,
      transparent: true,
      alphaTest: 0.1,
      depthWrite: false,
      roughness: 0.85,
      metalness: 0.0,
      opacity: 0.95
    });
    
    const bgMesh = new THREE.Mesh(bgCylinderGeometry, bgMat);
    bgMesh.castShadow = false;
    
    // 每个背景柱体放到单独的组，便于整体旋转与垂直滚动
    const group = new THREE.Group();
    group.position.set(dx, cfg.dy, cfg.dz);
    group.add(bgMesh);
    bgRoot.add(group);
    
    bgCylinders.push({
      group,
      mesh: bgMesh,
      map: bgTex,
      baseY: cfg.dy,
      baseDz: cfg.dz,
      scrollDir: cfg.scrollDir,
      speedFactor: cfg.speedFactor
    });
  }
}
createBackgroundCylinders();

// 控制台辅助：在线调整背景柱体的左右位置映射（0-100）与范围
window.setBgXPercent = function (index, percent) {
  const i = Number(index) | 0;
  if (i < 0 || i >= bgCylinders.length) return;
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  bgXPercent[i] = p;
  const dx = percentToBgX(p);
  const c = bgCylinders[i];
  c.group.position.x = dx;
};
window.setBgXRange = function (minX, maxX) {
  const minVal = Number(minX);
  const maxVal = Number(maxX);
  if (!isFinite(minVal) || !isFinite(maxVal)) return;
  bgXRange.min = Math.min(minVal, maxVal);
  bgXRange.max = Math.max(minVal, maxVal);
  // 重新应用所有的位置
  for (let i = 0; i < bgCylinders.length; i++) {
    const p = bgXPercent[i] ?? (i * 20);
    bgCylinders[i].group.position.x = percentToBgX(p);
  }
};
window.getBgXPercent = function () {
  return bgXPercent.slice();
};
// 调整背景透明度范围（近处与远处的目标不透明度）
window.setBgOpacityRange = function (nearOp, farOp) {
  const n = Math.max(0, Math.min(1, Number(nearOp)));
  const f = Math.max(0, Math.min(1, Number(farOp)));
  window.__bgNearOpacity = n;
  window.__bgFarOpacity = f;
};

// 背景柱体“距离/尺度差异”独立控制：每根 0..100
// 直接在这里编辑 11 个数（0..100）以控制每根柱体的远近与大小
// 保留原9根的设置，在“最左侧第1与第3根之间”插入两根并赋予随机远近系数
let bgDistancePercent = [
  0,
  2,
  8,
  43,
  2,
  30,
  10,
  25,
  15,
  25,
  5
];
window.setBgDistance = function (index, percent) {
  const i = Number(index) | 0;
  if (i < 0 || i >= bgCylinders.length) return;
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  bgDistancePercent[i] = p;
};
window.getBgDistance = function () {
  return bgDistancePercent.slice();
};

// 每根柱体不透明度缩放（默认 1.0），从右往左第3、第4根适度降低
// 顺序与 bgCylinders 一致（对应 bgXPercent 从左到右的11根）
let bgOpacityScale = [1.0, 0.85, 1.0, 0.75, 1.0, 0.65, 0.55, 0.6, 0.5, 0.85, 0.75];
window.setBgOpacityScale = function (index, scale) {
  const i = Number(index) | 0;
  if (i < 0 || i >= bgCylinders.length) return;
  const s = Number(scale);
  if (!isFinite(s)) return;
  bgOpacityScale[i] = Math.max(0.0, Math.min(1.0, s));
};
window.getBgOpacityScale = function () {
  return bgOpacityScale.slice();
};

// 个别柱体强制固定透明度（优先级高于距离插值与缩放），其余用 null
// 将“插入的两根”（索引 1 与 3）固定为 0.65
let bgOpacityFixed = [null, null, null, null, null, null, null, null, null, null, null];
window.setBgFixedOpacity = function (index, value) {
  const i = Number(index) | 0;
  if (i < 0 || i >= bgCylinders.length) return;
  if (value === null) { bgOpacityFixed[i] = null; return; }
  const v = Number(value);
  if (!isFinite(v)) return;
  bgOpacityFixed[i] = Math.max(0.0, Math.min(1.0, v));
};
window.getBgFixedOpacity = function () {
  return bgOpacityFixed.slice();
};

// 自适应取景：在不同屏幕比例下保持主体填充比例
function updateResponsiveFraming() {
  // 更新相机投影与画布尺寸
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);

  // 根据主体包围盒计算所需距离
  tiltGroup.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(drumGroup);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const target = center.clone().add(compositionTargetOffset);
  // 应用用户的水平偏移：在相机“看向”的目标上加偏移
  target.x += userHorizontalOffset;

  const vFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
  const fitHeightDistance = (size.y * 0.5) / Math.tan(vFov);
  const fitWidthDistance = (size.x * 0.5) / (Math.tan(vFov) * camera.aspect);
  let distance = Math.max(fitHeightDistance, fitWidthDistance) * 1.08; // 留白系数
  // 关键：按当前缩放系数拉近相机，让 userScale 直观生效
  const currentScale = (typeof pivotGroup !== 'undefined' && pivotGroup.scale) ? pivotGroup.scale.x : 1.0;
  if (currentScale && currentScale > 0) {
    distance = distance / currentScale;
  }

  const newPos = target.clone().add(initialViewDir.clone().multiplyScalar(distance));
  camera.position.copy(newPos);
  camera.lookAt(target);
}

const ringShape = new THREE.Shape();
ringShape.absarc(0, 0, radius, 0, Math.PI * 2, false);
const holePath = new THREE.Path();
holePath.absarc(0, 0, radius - 0.1, 0, Math.PI * 2, true);
ringShape.holes.push(holePath);

const ringGeometry = new THREE.ShapeGeometry(ringShape);
const ringMaterial = new THREE.MeshStandardMaterial({
  color: 0xcccccc,
  roughness: 0.5,
  metalness: 0.3
});

const topRing = new THREE.Mesh(ringGeometry, ringMaterial);
topRing.rotation.x = -Math.PI / 2;
topRing.position.y = height / 2;
topRing.castShadow = false;
topRing.visible = false;
drumGroup.add(topRing);

const bottomRing = new THREE.Mesh(ringGeometry, ringMaterial);
bottomRing.rotation.x = -Math.PI / 2;
bottomRing.position.y = -height / 2;
bottomRing.castShadow = false;
bottomRing.visible = false;
drumGroup.add(bottomRing);

let rotationSpeed = 0.0006; 
let currentRotationSpeed = 0.0006; // 当前实际速度
let targetRotationSpeed = 0.0006;  // 目标速度
const ROTATION_EASE = 0.1; // 旋转速度插值系数

// 悬停控制：恒定缓慢速度
let scrollOffset = 0; // 位移累计（世界单位）
// 改为自动恒定向上滚动
let AUTO_SCROLL_SPEED = 0.0018; // 每帧世界单位，基础速度（正值=向上）
window.setAutoScrollSpeed = function (speed) {
  const s = Number(speed);
  if (!isFinite(s)) return;
  AUTO_SCROLL_SPEED = s;
};
// 全局纵向滚动速度缩放系数（应用于主柱体与所有背景柱体UV滚动）
let UV_SCROLL_MULTIPLIER = 2.8; // 默认提升到约当前的1.5倍
window.setScrollSpeedScale = function (scale) {
  const s = Number(scale);
  if (!isFinite(s) || s <= 0) return;
  UV_SCROLL_MULTIPLIER = s;
};

// 取消鼠标悬停上下控制（展览模式禁用）

// 射线检测（用于中心取样）
const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2();
let pauseRotation = false;
let dimOpacity = 0.0;        // 当前灰色遮罩透明度
let targetDimOpacity = 0.0;  // 目标透明度
const DIM_EASE = 0.15;       // 提高插值速度，更快响应
const MAX_DIM_OPACITY = 0.65;

// 自动展示队列（优先新内容）
const recentShowQueue = [];
const recentShowSet = new Set();

// 当前高亮的单词索引集合（用于自动展示时高亮对应句子）
let highlightedWordIndices = new Set();
// 标记是否需要重绘覆盖层
let overlayNeedsRedraw = false;

// 计算停留时长（3s~6s），随句长线性映射
function computeDwellMs(en, zh) {
  const baseText = `${en || ''} ${zh || ''}`.trim();
  const len = Math.max(1, baseText.length);
  const tMin = 3000, tMax = 6000;
  // 将长度映射到区间（阈值可调）
  const L0 = 40, L1 = 200; // 40字以内≈3s，200字及以上≈6s
  const t = len <= L0 ? tMin
    : len >= L1 ? tMax
    : Math.round(tMin + (tMax - tMin) * ((len - L0) / (L1 - L0)));
  return t;
}

// 根据句子内容反查其在画布上的大致v坐标（0..1），优先取首个可命中的单词
function getVForSentence(enSentence) {
  if (!enSentence || !wordBoxes || wordBoxes.length === 0) return undefined;
  const tokens = enSentence.split(/\s+/).map(s => s.trim()).filter(Boolean);
  for (let t = 0; t < tokens.length; t++) {
    const tok = tokens[t].toLowerCase();
    for (let i = 0; i < wordBoxes.length; i++) {
      const b = wordBoxes[i];
      if ((b.text || '').toLowerCase() === tok) {
        const y = b.y; // 顶部对齐坐标，[0, baseCanvasHeight)
        const v = 1 - (y / baseCanvasHeight);
        return Math.max(0, Math.min(1, v));
      }
    }
  }
  return undefined;
}

// 根据句子内容找到对应的所有单词在 wordBoxes 中的索引
function getWordIndicesForSentence(enSentence) {
  const indices = new Set();
  if (!enSentence || !wordBoxes || wordBoxes.length === 0) return indices;
  // 将句子拆分为单词（去除标点）
  const tokens = enSentence.split(/\s+/).map(s => s.trim().replace(/[.,;:!?'"()[\]{}]/g, '').toLowerCase()).filter(Boolean);
  const tokenSet = new Set(tokens);
  for (let i = 0; i < wordBoxes.length; i++) {
    const b = wordBoxes[i];
    const wordClean = (b.text || '').replace(/[.,;:!?'"()[\]{}]/g, '').toLowerCase();
    if (tokenSet.has(wordClean)) {
      indices.add(i);
    }
  }
  return indices;
}

// 绘制覆盖层：非高亮单词绘制为浅灰，高亮单词不绘制（保持原色）
function drawOverlayExcludingIndices(indicesToExclude) {
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  const scale = 0.5; // 覆盖层分辨率比例
  overlayCtx.fillStyle = '#FAFAFA'; // 浅灰色，让非目标单词变淡
  overlayCtx.font = `${baseFontSize * scale}px "Sitka", serif`;
  overlayCtx.textAlign = 'left';
  overlayCtx.textBaseline = 'top';
  
  for (let i = 0; i < wordBoxes.length; i++) {
    if (indicesToExclude.has(i)) continue; // 跳过高亮单词，不绘制（保持原色）
    const b = wordBoxes[i];
    overlayCtx.fillText(b.text, b.x * scale, b.y * scale);
  }
  overlayTexture.needsUpdate = true;
}

// 更新高亮：根据当前显示的句子更新覆盖层
function updateHighlightForSentence(enSentence) {
  highlightedWordIndices = getWordIndicesForSentence(enSentence);
  drawOverlayExcludingIndices(highlightedWordIndices);
  targetDimOpacity = MAX_DIM_OPACITY; // 显示覆盖层
}

// 屏幕中心取样：拾取当前正面中心区域的单词并拼句
function sampleCenterSentence() {
  mouseNDC.set(0, 0); // 屏幕中心
  raycaster.setFromCamera(mouseNDC, camera);
  const hit = raycaster.intersectObject(cylinder, false);
  if (hit && hit.length > 0 && hit[0].uv && hit[0].face) {
    // 判断是否正面±45°
    const worldNormal = hit[0].face.normal.clone();
    worldNormal.transformDirection(cylinder.matrixWorld);
    worldNormal.normalize();
    const cameraDir = new THREE.Vector3();
    camera.getWorldDirection(cameraDir);
    cameraDir.negate();
    const dot = worldNormal.dot(cameraDir);
    if (dot > 0.707) {
      let uTex = hit[0].uv.x * (texture.repeat.x || 1) + (texture.offset.x || 0);
      let vTex = hit[0].uv.y * (texture.repeat.y || 1) + (texture.offset.y || 0);
      uTex = uTex - Math.floor(uTex);
      vTex = vTex - Math.floor(vTex);
      const px = uTex * baseCanvasWidth;
      const py = (1 - vTex) * baseCanvasHeight;
      // 找到包含该点的单词
      for (let i = 0; i < wordBoxes.length; i++) {
        const b = wordBoxes[i];
        if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) {
          const ext = findExtendedSentenceForWord(b.text);
          if (ext && (ext.en || ext.zh)) {
            return { ...ext, v: vTex };
          }
          break;
        }
      }
      // 没有正中命中单词：在中心上下4行范围内随机挑选一个单词再拼句
      const half = 4;
      const yMin = py - half * baseLineHeight;
      const yMax = py + half * baseLineHeight;
      const candidates = [];
      for (let i = 0; i < wordBoxes.length; i++) {
        const b = wordBoxes[i];
        if (b.y >= yMin && b.y <= yMax) { candidates.push(b.text); }
      }
      if (candidates.length > 0) {
        const rnd = candidates[Math.floor(Math.random() * candidates.length)];
        const ext = findExtendedSentenceForWord(rnd);
        if (ext && (ext.en || ext.zh)) {
          return { ...ext, v: vTex };
        }
      }
    }
  }
  // 兜底：随机挑选一行近邻句子
  if (poemLines.length > 0) {
    const idx = Math.floor(Math.random() * poemLines.length);
    const ext = assembleSentenceFromIndex(idx);
    return { ...ext, v: undefined };
  }
  return { en: '', zh: '', v: undefined };
}

// 自动展示调度
let autoDisplayTimer = null;
async function runAutoDisplay() {
  // 优先新内容
  let item = null;
  while (recentShowQueue.length > 0 && !item) {
    const cand = recentShowQueue.shift();
    const key = (cand && cand.en) ? cand.en.trim() : '';
    if (key && recentShowSet.has(key)) {
      item = cand;
    }
  }
  // 兜底：中心取样
  if (!item) {
    item = sampleCenterSentence();
  }
  if (item && (item.en || item.zh)) {
    displayQuoteAtRandomPosition(item.en || '', item.zh || '');
    // 根据显示的句子更新覆盖层高亮（非目标单词变淡，目标单词保持原色）
    updateHighlightForSentence(item.en || '');
    const dwell = computeDwellMs(item.en || '', item.zh || '');
    window.__lastDwellMs = dwell;
    autoDisplayTimer = setTimeout(runAutoDisplay, dwell);
  } else {
    // 没有可展示内容时，稍后再试
    autoDisplayTimer = setTimeout(runAutoDisplay, 3000);
  }
}
function scheduleAutoDisplayStart() {
  if (autoDisplayTimer) clearTimeout(autoDisplayTimer);
  autoDisplayTimer = setTimeout(runAutoDisplay, 1000);
}
window.kickAutoDisplay = function () {
  if (autoDisplayTimer) clearTimeout(autoDisplayTimer);
  runAutoDisplay();
};
function testIntersect(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  mouseNDC.set(x, y);
  raycaster.setFromCamera(mouseNDC, camera);
  const hit = raycaster.intersectObject(cylinder, false);
  return hit && hit.length > 0 ? hit[0] : null;
}

// 展览模式：禁用鼠标悬停拾取与暂停旋转

// 展览模式：禁用点击选词展示诗句

// 初始化完成后移除Loading遮罩
function removeLoadingOverlay() {
  if (loadingOverlay && loadingOverlay.parentNode) {
    loadingOverlay.parentNode.removeChild(loadingOverlay);
  }
}

// 左侧滑出信息面板：展示诗歌出处
const sidePanel = document.createElement('div');
sidePanel.style.position = 'fixed';
sidePanel.style.left = '-220px'; // 初始只露出10px
sidePanel.style.top = '0';
sidePanel.style.bottom = '0';
sidePanel.style.width = '190px';
sidePanel.style.padding = '0';
sidePanel.style.background = 'rgba(255, 255, 255, 0.95)';
sidePanel.style.zIndex = '9999';
sidePanel.style.transition = 'left 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
sidePanel.style.userSelect = 'none';
sidePanel.style.boxShadow = '2px 0 10px rgba(0,0,0,0.1)';
sidePanel.style.display = 'flex';
sidePanel.style.flexDirection = 'column';
sidePanel.style.justifyContent = 'center';
sidePanel.style.paddingLeft = '10px';
sidePanel.style.paddingRight = '10px';

function addPanelLine(enText, zhText) {
  const line = document.createElement('div');
  line.style.marginBottom = '16px';

  const en = document.createElement('div');
  en.style.fontFamily = '"Sitka", serif';
  en.style.fontSize = (13 * uiFontScale) + 'px';
  en.style.color = '#333333';
  en.style.fontWeight = '600';
  en.style.textAlign = 'left';
  en.style.lineHeight = '1.4';
  en.textContent = enText;

  const zh = document.createElement('div');
  zh.style.fontFamily = 'SimSun, "宋体", serif';
  zh.style.fontSize = (12 * uiFontScale) + 'px';
  zh.style.color = '#666666';
  zh.style.fontWeight = '400';
  zh.style.textAlign = 'left';
  zh.style.lineHeight = '1.5';
  zh.style.marginTop = '4px';
  zh.textContent = zhText;

  line.appendChild(en);
  line.appendChild(zh);
  sidePanel.appendChild(line);
}

// 初始默认内容
addPanelLine('Poems by Pablo Neruda——', '诗歌选自聂鲁达——');
addPanelLine('VII Leaning into the afternoon', '七，倚身在暮色里');
addPanelLine('XIII I have gone marking', '十三，我以火的十字');
addPanelLine('XX A Song of Despair (excerpt)', '二十，一首绝望的歌（节选）');

document.body.appendChild(sidePanel);

// 更新左侧面板内容
function updateSidePanel(poemsData) {
  if (!poemsData || !poemsData.poems || poemsData.poems.length === 0) return;
  
  // 清空面板内容
  sidePanel.innerHTML = '';
  
  // 添加标题
  const title = document.createElement('div');
  title.style.fontFamily = '"Sitka", serif';
  title.style.fontSize = (11 * uiFontScale) + 'px';
  title.style.color = '#999999';
  title.style.letterSpacing = '0.08em';
  title.style.textTransform = 'uppercase';
  title.style.marginBottom = '24px';
  title.style.borderBottom = '1px solid #eeeeee';
  title.style.paddingBottom = '12px';
  title.textContent = 'Poetry Sources';
  sidePanel.appendChild(title);
  
  // 去重：如果作者重复，仅保留第一条
  const seenAuthors = new Set();
  poemsData.poems.forEach((poem, index) => {
    // 跳过没有 source 字段的诗歌（旧数据）
    if (!poem.source) {
      // 兜底显示作者信息
      if (poem.author) {
        if (!seenAuthors.has(poem.author)) {
          addPanelLine(`Poems by ${poem.author}`, '');
          seenAuthors.add(poem.author);
        }
      }
      return;
    }
    
    // 显示格式：Poems by "author"—"source"
    const authorName = poem.author || 'Unknown';
    if (!seenAuthors.has(authorName)) {
      const displayLine = `Poems by ${authorName}—${poem.source}`;
      addPanelLine(displayLine, '');
      seenAuthors.add(authorName);
    }
  });
  
  // 添加更新时间
  if (poemsData.updatedAt) {
    const updateInfo = document.createElement('div');
    updateInfo.style.fontFamily = '"Sitka", serif';
    updateInfo.style.fontSize = (10 * uiFontScale) + 'px';
    updateInfo.style.color = '#cccccc';
    updateInfo.style.marginTop = '24px';
    updateInfo.style.paddingTop = '12px';
    updateInfo.style.borderTop = '1px solid #eeeeee';
    updateInfo.style.textAlign = 'center';
    const date = new Date(poemsData.updatedAt);
    updateInfo.textContent = `Updated ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    sidePanel.appendChild(updateInfo);
  }
}

// 左侧提示线（在面板露出的10px边缘）
const hintLine = document.createElement('div');
hintLine.style.position = 'fixed';
hintLine.style.left = '8px';
hintLine.style.top = '50%';
hintLine.style.transform = 'translateY(-50%)';
hintLine.style.width = '1px';
hintLine.style.height = '580px';
hintLine.style.background = '#cccccc';
hintLine.style.zIndex = '10000';
hintLine.style.transition = 'opacity 1s ease';
hintLine.style.opacity = '1';
hintLine.style.pointerEvents = 'none';
document.body.appendChild(hintLine);

// 提示线动画：每3秒淡出，1秒内重新显示
setInterval(() => {
  hintLine.style.opacity = '0';
  setTimeout(() => {
    hintLine.style.opacity = '1';
  }, 1000);
}, 3000);

// 鼠标悬停左侧显示面板
let sidePanelTimeout;
document.addEventListener('mousemove', (e) => {
  if (e.clientX < 50) {
    // 鼠标在左侧50px内，显示面板
    sidePanel.style.left = '0';
    clearTimeout(sidePanelTimeout);
  } else if (e.clientX > 200) {
    // 鼠标移出210px外，0.5s后隐藏
    clearTimeout(sidePanelTimeout);
    sidePanelTimeout = setTimeout(() => {
      sidePanel.style.left = '-225px';
    }, 200);
  }
});

// 搜索栏与搜索高亮：展览模式移除


window.addEventListener('resize', () => {
  updateResponsiveFraming();
});

function animate() {
  requestAnimationFrame(animate);
  
  // 平滑旋转速度过渡
  currentRotationSpeed += (targetRotationSpeed - currentRotationSpeed) * ROTATION_EASE;
  drumGroup.rotation.y += currentRotationSpeed;
  
  // 自动恒定向上滚动（应用全局速度缩放）
  scrollOffset += AUTO_SCROLL_SPEED * UV_SCROLL_MULTIPLIER;
  
  // 仅滚动UV（不移动几何体），获得真正无限的上下循环
  const LOOP_SPAN = height; // 基于几何高度的归一化
  drumGroup.position.y = drumBasePosition.y;
  let offsetV = (scrollOffset / LOOP_SPAN) % 1;
  if (offsetV < 0) offsetV += 1;
  texture.offset.y = offsetV;
  // 覆盖层与主纹理完全同步（跟随旋转/滚动）
  overlayTexture.offset.y = offsetV;
  overlayTexture.repeat.copy(texture.repeat);
  
  // 背景柱体：与主柱体一致的旋转；垂直滚动联动但方向/速度可不同
  if (bgCylinders.length > 0) {
    // 计算每根背景柱体与相机的距离，用于按距离设置透明度（近更透明，远更不透明）
    const tmp = new THREE.Vector3();
    let minDist = Infinity;
    let maxDist = -Infinity;
    for (let i = 0; i < bgCylinders.length; i++) {
      const bg = bgCylinders[i];
      // 独立距离/尺度：每根使用自己的 0..100 参数
      const p = Math.max(0, Math.min(100, Number(bgDistancePercent[i] || 0)));
      const depthSpread = 1.0 + (p / 100) * 2.0;   // 1.0..3.0 展开更明显
      const targetScale = THREE.MathUtils.lerp(1.0, 0.5, p / 100); // 1.0..0.5
      if (typeof bg.baseDz === 'number') { bg.group.position.z = bg.baseDz * depthSpread + bgZOffset; }
      bg.group.scale.setScalar(targetScale);
      const posW = bg.group.getWorldPosition(tmp);
      const d = posW.distanceTo(camera.position);
      if (d < minDist) minDist = d;
      if (d > maxDist) maxDist = d;
    }
    const nearOpacity = (typeof window.__bgNearOpacity === 'number') ? window.__bgNearOpacity : 0.25; // 近处更透明
    const farOpacity = (typeof window.__bgFarOpacity === 'number') ? window.__bgFarOpacity : 0.80;    // 远处更不透明
    const distSpan = Math.max(1e-6, maxDist - minDist);
    
    for (let i = 0; i < bgCylinders.length; i++) {
      const bg = bgCylinders[i];
      // 旋转与主柱体一致
      bg.group.rotation.y += currentRotationSpeed;
      // 根据主scrollOffset推导背景滚动（方向与速度各异）
      const bgOffset = scrollOffset * bg.speedFactor * bg.scrollDir;
      // 背景几何竖直位置固定，通过贴图UV偏移实现无限滚动
      bg.group.position.y = bg.baseY;
      // 纹理偏移（与垂直位移一致，以获得无缝循环效果）
      let vBg = (bgOffset / LOOP_SPAN) % 1;
      if (vBg < 0) vBg += 1;
      if (bg.map) {
        bg.map.offset.y = vBg;
      }
      // 根据距离设置不透明度
      const pos = bg.group.getWorldPosition(tmp);
      const d = pos.distanceTo(camera.position);
      const t = (d - minDist) / distSpan; // 0..1
      // 若配置了固定不透明度，则优先使用；否则走距离插值 * 每根缩放
      let opacity;
      const fixed = Array.isArray(bgOpacityFixed) ? bgOpacityFixed[i] : null;
      if (typeof fixed === 'number') {
        opacity = fixed;
      } else {
        const baseOpacity = nearOpacity + t * (farOpacity - nearOpacity);
        const scale = (typeof bgOpacityScale[i] === 'number') ? bgOpacityScale[i] : 1.0;
        opacity = Math.max(0.0, Math.min(1.0, baseOpacity * scale));
      }
      if (bg.mesh && bg.mesh.material) {
        bg.mesh.material.opacity = opacity;
        bg.mesh.material.transparent = true;
        bg.mesh.material.needsUpdate = false;
      }
    }
  }

  // 平滑灰色遮罩透明度过渡
  dimOpacity += (targetDimOpacity - dimOpacity) * DIM_EASE;
  overlayMaterial.opacity = dimOpacity;
  
  renderer.render(scene, camera);
}

// 纹理准备就绪后移除加载遮罩（本地Canvas立即完成，保险起见加一帧）
requestAnimationFrame(() => removeLoadingOverlay());
// 初始化顺序：先锚定 → 应用pivot/scale → 自适应
requestAnimationFrame(() => {
  setupFramingAnchors();
  applyUserPivotAndScale();
  updateResponsiveFraming();
});

// 远程API配置（可接入代理或网关）
const REMOTE_API_BASE = (window.__POEM_API_BASE__) || '';
const REMOTE_ENDPOINT = REMOTE_API_BASE ? `${REMOTE_API_BASE.replace(/\/$/, '')}/poems` : '';

async function fetchRemotePoems() {
  if (!REMOTE_ENDPOINT) return null;
  const cacheBust = `cb=${Date.now()}`;
  const url = `${REMOTE_ENDPOINT}?${cacheBust}`;
  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
    if (!res.ok) throw new Error(`Remote fetch failed: ${res.status}`);
    const data = await res.json();
    // 预期结构：{ poems: [{ lines:["..."], translations: { enLine: zhLine }, author:"..." }], updatedAt: "..." }
    return data;
  } catch (e) {
    console.warn('fetchRemotePoems error:', e);
    return null;
  }
}

function appendPoemsToSource(remoteData) {
  if (!remoteData || !remoteData.poems) return;
  
  console.log('Appending poems to source:', remoteData.poems.length);
  
  const addedLines = [];
  // 以“整首诗（多行）”为单位加入优先展示队列，避免把用户换行诗句拆成多条展示
  const addedPoemBlocks = [];
  
  remoteData.poems.forEach((p, index) => {
    if (p && p.hidden) return; // 跳过被隐藏的已发布诗歌
    console.log(`Processing poem ${index + 1}:`, p.author, `(${p.lines?.length || 0} lines)`);
    
    // 处理诗句
    const groupId = p.publishedAt || p.submittedAt || `grp_${Date.now()}_${index}`;
    const poemLinesAll = [];
    let poemAddedAny = false;
    if (Array.isArray(p.lines)) {
      p.lines.forEach(rawLine => {
        if (typeof rawLine === 'string' && rawLine.trim()) {
          let line = rawLine.trim();
          // 兼容行内"原句 → 中文"提交格式，自动拆分为翻译映射
          // 同时保留左侧原句进入贴图/匹配
          const arrowMatch = line.split(/\s*[→=>-]+\s*/);
          if (arrowMatch.length === 2) {
            const left = arrowMatch[0].trim();
            const right = arrowMatch[1].trim();
            if (left && right) {
              translationMap[left] = right;
              line = left; // 仅把左侧原句进入文本
            }
          }
          const trimmedLine = line;
          poemLinesAll.push(trimmedLine);
          // 仅在真正新增时才加入 addedLines 与结构，避免画布重复
          if (!poemLines.includes(trimmedLine)) {
            poemLines.push(trimmedLine);
            lineGroups.push(groupId);
            addedLines.push(trimmedLine);
            poemAddedAny = true;
          }
        }
      });
    }
    
    // 处理翻译映射
    if (p.translations && typeof p.translations === 'object') {
      Object.keys(p.translations).forEach(enRaw => {
        const zh = p.translations[enRaw];
        if (typeof enRaw === 'string' && typeof zh === 'string' && enRaw.trim()) {
          const enTrim = enRaw.trim();
          const enNoEnd = enTrim.replace(/[.;]\s*$/, '');
          const enNorm = enNoEnd.replace(/\s+/g, ' ');
          // 存入多种规范化键，提升点击/拼句后的匹配成功率
          translationMap[enTrim] = zh;
          translationMap[enNoEnd] = zh;
          translationMap[enNorm] = zh;
          console.log(`Added translation: "${enTrim.substring(0, 40)}" -> "${zh.substring(0, 40)}"`);
        }
      });
    }
    // 如果本次确实新增了这首诗的内容，则把“整首（含换行）”加入优先展示队列
    if (poemAddedAny && poemLinesAll.length > 0) {
      const enBlock = poemLinesAll.join('\n');
      // 尝试逐行拼中文（有就显示，没有就留空；全空则不显示中文块）
      const zhLines = poemLinesAll.map(enLine => {
        const trimmedEnd = enLine.replace(END_PUNCT, '');
        if (p.translations && typeof p.translations === 'object' && typeof p.translations[enLine] === 'string') {
          return p.translations[enLine];
        }
        if (translationMap[enLine]) return translationMap[enLine];
        if (translationMap[trimmedEnd]) return translationMap[trimmedEnd];
        return '';
      });
      const zhBlockRaw = zhLines.join('\n');
      const zhBlock = zhBlockRaw.replace(/[\n\r\s]+/g, '').length > 0 ? zhLines.join('\n') : '';
      addedPoemBlocks.push({ en: enBlock, zh: zhBlock });
    }
  });
  
  if (addedLines.length > 0) {
    console.log(`Adding ${addedLines.length} new lines to poem text`);
    
    // 组装新增文本块
    const tail = addedLines.join('\n');
    
    // 合并策略改为“前置到开头”：让新增诗句优先出现在转筒上部分
    // 1) 更新 poemSource（完整库，前置）
    const needsSepBefore = tail && !tail.endsWith('\n');
    const sepBetween = poemSource.startsWith('\n') || !poemSource ? '' : '\n';
    poemSource = `${tail}${needsSepBefore ? '\n' : ''}${sepBetween}${poemSource}`;
    
    // 2) 更新 currentPoemText（前置）并重建纹理
    prependPoemText(tail);
    
    console.log('Poem text updated (prepended). Total lines in poemLines:', poemLines.length);
    console.log('Total translations:', Object.keys(translationMap).length);
    // 将新增的“整首诗（多行）”加入优先展示队列（去重）
    if (Array.isArray(addedPoemBlocks) && addedPoemBlocks.length) {
      for (const poem of addedPoemBlocks) {
        const key = (poem.en || '').trim();
        if (key && !recentShowSet.has(key)) {
          recentShowSet.add(key);
          recentShowQueue.unshift({ en: poem.en, zh: poem.zh });
        }
      }
      // 触发一次立即展示
      if (typeof window.kickAutoDisplay === 'function') {
        window.kickAutoDisplay();
      }
    }
    return addedLines.length;
  } else {
    console.warn('No lines added from remote data');
    return 0;
  }
}

// 用于更新转筒文本并刷新纹理与映射
function updatePoemText(extraText) {
  // 1) 更新poemText字符串（用于贴图生成）
  if (extraText && typeof extraText === 'string') {
    // 直接在末尾追加
    currentPoemText += extraText;
  }
  // 2) 重建纹理与wordBoxes
  rebuildTextTextureAndMapping();
}

let currentPoemText = null;

// 前置文本并重建纹理（让新增内容优先出现）
function prependPoemText(extraText) {
  if (extraText && typeof extraText === 'string') {
    const needsSepAfter = extraText && !extraText.endsWith('\n');
    const sepBetween = (currentPoemText && !currentPoemText.startsWith('\n')) ? '\n' : '';
    currentPoemText = `${extraText}${needsSepAfter ? '\n' : ''}${sepBetween}${currentPoemText || ''}`;
  }
  rebuildTextTextureAndMapping();
}

function rebuildTextTextureAndMapping() {
  // 重绘主文本画布并重建wordBoxes
  const textCanvas = createTextCanvas(currentPoemText || poemText);
  const newTexture = new THREE.CanvasTexture(textCanvas);
  newTexture.wrapS = THREE.RepeatWrapping;
  newTexture.wrapT = THREE.RepeatWrapping;
  newTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  newTexture.generateMipmaps = true;
  newTexture.minFilter = THREE.LinearMipmapLinearFilter;
  newTexture.magFilter = THREE.LinearFilter;
  newTexture.colorSpace = THREE.SRGBColorSpace;
  newTexture.needsUpdate = true;
  newTexture.repeat.copy(texture.repeat);
  newTexture.offset.copy(texture.offset);

  cylinderMaterial.map = newTexture;
  cylinderMaterial.needsUpdate = true;

  // 覆盖层重建
  initOrResizeOverlay();
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  overlayTexture.needsUpdate = true;

  // 替换引用
  if (texture) texture.dispose();
  texture = newTexture;
}

// 每日自动刷新（本地时间午夜后首次进入或手动触发）
function scheduleDailyRefresh() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0); // 下一次午夜
  const delay = Math.max(1000, next.getTime() - now.getTime());
  setTimeout(async () => {
    const remote = await fetchRemotePoems();
    appendPoemsToSource(remote);
    scheduleDailyRefresh();
  }, delay);
}

// 初始化远程加载
(async function initRemoteLoad() {
  currentPoemText = poemText; // 初始化当前文本
  if (REMOTE_ENDPOINT) {
    console.log('Fetching poems from:', REMOTE_ENDPOINT);
    const remote = await fetchRemotePoems();
    if (remote && remote.poems) {
      console.log('Loaded poems:', remote.poems.length);
      appendPoemsToSource(remote);
      updateSidePanel(remote); // 更新左侧面板
    } else {
      console.warn('No poems received from API');
    }
    scheduleDailyRefresh();
  } else {
    console.warn('REMOTE_ENDPOINT not configured');
  }
})();

// 可复用：完整刷新流程（避免页面整页刷新）
let refreshInProgress = false;
async function fullRefreshFromRemote(triggerLabel) {
  if (!REMOTE_ENDPOINT) return 0;
  if (refreshInProgress) return 0;
  refreshInProgress = true;
  let addedCount = 0;
  try {
    console.log(`=== ${triggerLabel || 'Manual'} refresh triggered ===`);
    const remote = await fetchRemotePoems();
    if (remote && remote.poems) {
      console.log('Refreshed poems from API (incremental):', remote.poems.length);
      // 增量模式：只追加从远端获取到的“新行”（appendPoemsToSource 已去重）
      addedCount = appendPoemsToSource(remote) || 0;
      updateSidePanel(remote);
      console.log('=== Incremental refresh complete ===');
    }
  } finally {
    refreshInProgress = false;
  }
  return addedCount;
}

// 添加手动刷新功能（按 R 键刷新诗歌）
window.addEventListener('keydown', async (e) => {
  if (e.key === 'r' || e.key === 'R') {
    fullRefreshFromRemote('Manual');
  }
});

// 自适应自动刷新：有更新时加快，无更新逐步放缓；页面隐藏时放缓
let smartRefreshTimer = null;
let minAutoMs = 60000;   // 有更新时的最快轮询
let maxAutoMs = 600000;  // 无更新时的最慢轮询
let nextAutoMs = 300000; // 启动默认
let pauseAuto = false;

function scheduleNextAuto(ms) {
  if (smartRefreshTimer) clearTimeout(smartRefreshTimer);
  smartRefreshTimer = setTimeout(runAutoRefresh, ms);
}

async function runAutoRefresh() {
  if (pauseAuto || document.hidden) {
    // 页面不可见或暂停时放缓到至少5分钟
    nextAutoMs = Math.max(nextAutoMs, 300000);
    scheduleNextAuto(nextAutoMs);
    return;
  }
  const added = await fullRefreshFromRemote('Auto(smart)');
  if (added > 0) {
    // 发现新内容：立即切到最快
    nextAutoMs = minAutoMs;
  } else {
    // 未发现新内容：逐步放缓（1.5倍回退），上限 maxAutoMs
    nextAutoMs = Math.min(maxAutoMs, Math.floor(nextAutoMs * 1.5));
  }
  scheduleNextAuto(nextAutoMs);
}

function runAutoRefreshNow() {
  nextAutoMs = minAutoMs;
  if (smartRefreshTimer) clearTimeout(smartRefreshTimer);
  runAutoRefresh();
}

// 前台控制接口
window.setAutoRefreshProfile = function (profileOrMin, maybeMax) {
  if (typeof profileOrMin === 'string') {
    const p = profileOrMin.toLowerCase();
    if (p === 'aggressive') { minAutoMs = 30000; maxAutoMs = 300000; }
    else if (p === 'eco')   { minAutoMs = 180000; maxAutoMs = 900000; }
    else                    { minAutoMs = 60000;  maxAutoMs = 600000; }
  } else {
    const mi = Number(profileOrMin);
    const ma = Number(maybeMax);
    if (isFinite(mi)) minAutoMs = Math.max(10000, mi);
    if (isFinite(ma)) maxAutoMs = Math.max(minAutoMs, ma);
  }
  nextAutoMs = Math.max(minAutoMs, Math.min(nextAutoMs, maxAutoMs));
  scheduleNextAuto(nextAutoMs);
};
window.pauseAutoRefresh = function (flag) {
  pauseAuto = !!flag;
  if (!pauseAuto) runAutoRefreshNow();
};
window.kickAutoRefresh = function () {
  runAutoRefreshNow();
};

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    runAutoRefreshNow();
  }
});

// 启动自适应轮询
scheduleNextAuto(nextAutoMs);

// 启动自动展示循环
scheduleAutoDisplayStart();

animate();