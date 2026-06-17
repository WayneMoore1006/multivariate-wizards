// ============================================================================
// scripts/answerCorrections.ts
// Authoritative, surgical corrections applied to the deduped bank by STEM match
// (never by id — ids change on re-import). Fixes acceptedAnswers that were
// polluted by foreign answers, enforces blankCount === answers.length ===
// acceptedAnswers.length, and stamps the restored standalone questions with their
// exact Chinese / explanation text.
// ============================================================================
import type { Question } from "../shared/types";

interface Correction {
  /** distinctive stem fragment (matched against whitespace-normalized questionEn) */
  key: RegExp;
  /** optional extra guard (e.g. blank count) */
  when?: (q: Question) => boolean;
  set: Partial<Question>;
  note?: string;
}

const n = (s: string) => s.replace(/\s+/g, " ").trim();

export const CORRECTIONS: Correction[] = [
  // ---- §五 polluted acceptedAnswers ----
  { key: /There are special MANOVA models, termed/i,
    set: { answers: ["repeated measures"], acceptedAnswers: [["repeated measures", "repeated measure"]], blankCount: 1,
      questionZh: "有一些特殊的 MANOVA 模型稱為 ______，可以處理這種觀察值的相依性，並仍然判斷個體之間在一組依變數上是否存在差異。",
      explanationZh: "<strong>重複量數（repeated measures）</strong>是一種特殊 MANOVA 模型，用於處理同一受試者被重複測量時觀察值之間的相依性，同時仍可偵測不同條件下依變數是否有差異。",
      explanationEn: "<strong>Repeated measures</strong> MANOVA models account for the dependence among observations when the same respondents are measured multiple times, while still testing for differences across dependent variables.",
    },
    note: "repeated measures must not accept 'contrast'" },

  { key: /is a linear combination of the two or more independent variables to discriminate best/i,
    set: { answers: ["The discriminant variate"], acceptedAnswers: [["The discriminant variate", "discriminant variate", "discriminant function"]], blankCount: 1,
      questionZh: "______ 是由兩個以上自變數所形成的線性組合，用來在事先定義的群體之間達到最佳區分。",
      explanationZh: "<strong>判別變量（discriminant variate）</strong>又稱 <strong>discriminant function</strong>，是自變數的線性組合，目的是最大化不同群體之間的差異，以達到最佳分類效果。",
      explanationEn: "The <strong>discriminant variate</strong> (also called <strong>discriminant function</strong>) is a linear combination of independent variables designed to maximally separate a priori defined groups.",
    },
    note: "discriminant variate must not accept 'potency index'" },

  { key: /Objectives of MANOVA are to analyze a dependence relationship/i,
    set: { answers: ["independent"], acceptedAnswers: [["independent"]], blankCount: 1,
      questionZh: "MANOVA 的目的是分析一種依賴關係，即一組依變數在由一個或多個 categorical ______ measures 所形成的群體之間的差異。",
      explanationZh: "MANOVA 分析的是依變數在不同群體之間的差異，這些群體是由一個或多個 <strong>categorical independent measures</strong>（類別型自變數）所定義的。空格答案是 <strong>independent</strong>。",
      explanationEn: "MANOVA analyzes differences in dependent variables across groups formed by one or more categorical <strong>independent</strong> measures. The blank asks for the type of measures that define the groups.",
    },
    note: "must not accept t-test / ANOVA" },

  { key: /The analysis sample is used to develop the discriminant function and the/i,
    set: { answers: ["holdout sample"], acceptedAnswers: [["holdout sample", "holdout"]], blankCount: 1,
      questionZh: "分析樣本（analysis sample）用來建立判別函數，而 ______ 則用來測試判別函數。",
      explanationZh: "<strong>保留樣本（holdout sample）</strong>是從原始樣本中分出的一部分，不參與模型建立，專門用來驗證判別函數的分類能力與推廣性。",
      explanationEn: "The <strong>holdout sample</strong> is a portion of the data set aside for testing the discriminant function, ensuring the model's classification accuracy generalizes beyond the estimation sample.",
    },
    note: "single blank; must not accept develop/test/estimate/validate" },

  { key: /for two-group situations and _+ for situations with three or more groups/i,
    when: (q) => q.answers.some((a) => /manova/i.test(a)),
    set: { answers: ["MANOVA"], acceptedAnswers: [["MANOVA", "multivariate analysis of variance"]], blankCount: 1,
      questionZh: "多變量技術中，Hotelling's T² 用於兩組情境，而 ______ 用於由兩個以上自變數定義的三組以上情境。",
      explanationZh: "<strong>Hotelling's T²</strong> 用於比較兩組在多個依變數上的差異；當群體數為三組以上（或有多個自變數），則使用 <strong>MANOVA</strong>（multivariate analysis of variance）。此題空格要填的是 MANOVA。",
      explanationEn: "<strong>Hotelling's T²</strong> is used for two-group comparisons on multiple dependent variables. For three or more groups (or multiple independent variables), <strong>MANOVA</strong> is used. The blank asks for MANOVA.",
    },
    note: "blank is MANOVA, not Hotelling's T2 (given in stem)" },

  { key: /is a measure of the strength of the overall relationships between the linear composites/i,
    set: { answers: ["Canonical correlation"], acceptedAnswers: [["Canonical correlation", "canonical correlation"]], blankCount: 1,
      questionZh: "______ 是衡量依變數與自變數的線性組合（canonical variates）之間整體關係強度的指標。",
      explanationZh: "<strong>典型相關（Canonical correlation）</strong>衡量的是兩組 canonical variates（依變數組與自變數組各自的線性組合）之間整體關係的強度。數值越高代表兩組變數之間的關聯越強。",
      explanationEn: "<strong>Canonical correlation</strong> measures the strength of the overall relationship between pairs of canonical variates (linear composites of dependent and independent variable sets).",
    },
    note: "must not accept Box's M" },

  { key: /provides a summary measure of the ability of a set of independent variables to explain variation/i,
    set: { answers: ["Redundancy measure"], acceptedAnswers: [["Redundancy measure", "Redundancy index", "redundancy measure", "redundancy index"]], blankCount: 1,
      questionZh: "______ 提供了一個摘要指標，衡量一組自變數對依變數變異的解釋能力。",
      explanationZh: "<strong>冗餘量數（Redundancy measure / Redundancy index）</strong>是 Canonical Correlation 分析中的指標，衡量一組自變數能解釋另一組依變數變異的比例，用來評估典型相關的實質意義。",
      explanationEn: "<strong>Redundancy measure</strong> (or <strong>Redundancy index</strong>) summarizes how much variance in one set of variables is explained by the canonical variates of the other set, assessing the practical significance of canonical correlations.",
    },
    note: "must not accept main effect" },

  { key: /The number of dependent variable groups can be two or more, but these groups must be/i,
    set: { answers: ["mutually exclusive", "exhaustive"], acceptedAnswers: [["mutually exclusive"], ["exhaustive"]], blankCount: 2 },
    note: "must not accept discriminant weight" },

  // §五-9 — 2-blank "____ is appropriate ... whereas ____ is utilized when DV is metric"
  { key: /is appropriate for research problems in which the dependent variable is categorical, whereas/i,
    when: (q) => q.blankCount === 2 || !/^discriminant analysis/i.test(n(q.questionEn)),
    set: { answers: ["Discriminant analysis", "regression"], acceptedAnswers: [["Discriminant analysis", "discriminant analysis"], ["regression"]], blankCount: 2,
      questionZh: "______ 適用於依變數為類別變項的研究問題，而 ______ 則用於依變數為計量變項時。",
    },
    note: "blank1 is the technique, not the DV type" },

  // §五-17 — 1-blank variant starting with 'Discriminant analysis is appropriate ...'
  { key: /^Discriminant analysis is appropriate for research problems in which the dependent variable is categorical, whereas/i,
    set: { answers: ["regression"], acceptedAnswers: [["regression"]], blankCount: 1 },
    note: "single blank = regression" },

  { key: /dependent variable is nonmetric and _+, representing groups/i,
    set: { answers: ["mutually exclusive"], acceptedAnswers: [["mutually exclusive"]], blankCount: 1 },
    note: "stem already says nonmetric" },

  { key: /For sample size consideration of the _+, the preferred ratio of observations to variables is _+ or _+ to 1/i,
    set: { answers: ["multiple regression analysis", "15", "20"], acceptedAnswers: [["multiple regression analysis"], ["15"], ["20"]], blankCount: 3,
      questionZh: "在 ______ 的樣本量考量中，觀測值與變項的建議比例為 ______ 或 ______ 比 1。",
    },
    note: "20 belongs to blank 3, not blank 1" },

  { key: /The four most widely used measures for assessing statistical significance/i,
    set: {
      answers: ["Roy's Greatest Characteristic Root", "Wilks' lambda", "Pillai's Criterion", "Hotelling's Trace"],
      acceptedAnswers: [
        ["Roy's Greatest Characteristic Root", "Roy's GCR", "Roy's greatest characteristic root"],
        ["Wilks' lambda", "Wilks lambda"],
        ["Pillai's Criterion", "Pillai's criterion"],
        ["Hotelling's Trace", "Hotelling's trace"],
      ], blankCount: 4,
      questionZh: "評估群體間統計顯著性最常用的四種指標為：______、______、______ 與 ______。",
    }, note: "Wilks' lambda is blank 2, not blank 1" },

  { key: /MANOVA presents the researcher with several criteria with which to assess multivariate differences across groups/i,
    set: {
      answers: ["Roy's gcr", "Wilks' \u03bb", "Hotelling's trace", "Pillai's criterion"],
      acceptedAnswers: [
        ["Roy's gcr", "Roy's GCR", "Roy's greatest characteristic root"],
        ["Wilks' \u03bb", "Wilks' lambda", "Wilks lambda"],
        ["Hotelling's trace", "Hotelling's Trace"],
        ["Pillai's criterion", "Pillai's Criterion"],
      ], blankCount: 4,
      questionZh: "MANOVA 最常用的四種評估多變量群體差異的準則為 ______、______、______ 與 ______。",
    }, note: "Wilks is blank 2" },

  { key: /The assumptions of multiple regression analysis to be examined are in four areas: linearity/i,
    set: { answers: ["constant variance of the error term"], acceptedAnswers: [["constant variance of the error term", "constant variance", "homoscedasticity"]], blankCount: 1,
      questionZh: "多元迴歸分析需要檢驗的假設有四個方面：linearity（線性）、______、normality（常態性）和 independence of the error term（誤差項獨立性）。",
      explanationZh: "<strong>誤差項的等變異數（constant variance of the error term）</strong>又稱 <strong>homoscedasticity</strong>，指的是在不同預測值下，殘差的變異數應保持一致。題幹中 linearity 已經被列出，空格要填的是 constant variance。",
      explanationEn: "<strong>Constant variance of the error term</strong> (homoscedasticity) means the residual variance should remain stable across different predicted values. Since linearity is already given in the stem, the blank asks for constant variance.",
    },
    note: "linearity is in the stem" },

  { key: /Research problems appropriate for multiple regression are prediction and/i,
    set: { answers: ["explanation"], acceptedAnswers: [["explanation", "\u89e3\u91cb"]], blankCount: 1,
      questionZh: "適合使用多元迴歸的研究問題包括 prediction（預測）與 ______。",
      explanationZh: "多元迴歸分析有兩大用途：<strong>prediction</strong>（預測）與 <strong>explanation</strong>（解釋）。此題題幹已給出 prediction，空格答案是 <strong>explanation</strong>。",
      explanationEn: "Multiple regression serves two primary purposes: <strong>prediction</strong> and <strong>explanation</strong>. Since prediction is already given in the stem, the blank asks for <strong>explanation</strong>.",
    },
    note: "prediction is in the stem" },

  // §五-16 — "General approaches to variable selections include ____"
  { key: /General approaches to variable selections include/i,
    when: (q) => q.blankCount === 1 || !/_+\s*,\s*_+\s*,\s*and\s*_+/.test(q.questionEn),
    set: { answers: ["confirmatory"], acceptedAnswers: [["confirmatory", "confirmatory approach", "\u9a57\u8b49\u5f0f"]], blankCount: 1,
      questionZh: "變數選擇的一般方法包括 ______、sequential search methods（逐步搜尋法）以及 combinatorial approach（組合式方法）。",
      explanationZh: "變數選擇有三大方法：<strong>confirmatory</strong>（驗證式）、<strong>sequential search methods</strong>（逐步搜尋法）和 <strong>combinatorial approach</strong>（組合式方法）。此題只有一個空格，答案是 <strong>confirmatory</strong>。",
      explanationEn: "Three general approaches to variable selection are <strong>confirmatory</strong>, <strong>sequential search methods</strong>, and <strong>combinatorial approach</strong>. This single-blank question asks for <strong>confirmatory</strong>.",
    },
    note: "single-blank confirmatory variant" },

  // ---- §六 template questions: full zh/explanation ----
  { key: /The dependent variable of discriminant analysis should be _+ and _+, represent/i,
    set: {
      questionZh: "判別分析的依變數應為 ______ 且 ______，代表不同的群體，且預期這些群體在自變數上有所差異。自變數必須能辨識至少 ______ 個群體之間的差異。",
      explanationZh: "判別分析的依變數必須是 <strong>nonmetric</strong>（非計量型）且 <strong>mutually exclusive</strong>（互斥的），代表事先定義的群體。自變數至少需辨識 <strong>two</strong>（兩個）群體間的差異。",
      explanationEn: "In discriminant analysis, the dependent variable must be <strong>nonmetric</strong> and <strong>mutually exclusive</strong>, representing predefined groups. The independent variables must identify differences between at least <strong>two</strong> groups.",
    } },

  { key: /it is good to have a large enough sample to divide it into an _+ and _+ sample/i,
    set: {
      questionZh: "在判別分析中，最好有足夠大的樣本，將其分為 ______ 樣本與 ______ 樣本。",
      explanationZh: "判別分析建議將樣本分成兩部分：<strong>estimation sample</strong>（估計樣本，用來建立判別函數）和 <strong>holdout sample</strong>（保留樣本，用來驗證模型的分類能力）。",
      explanationEn: "For discriminant analysis, the sample should be split into an <strong>estimation</strong> (analysis) sample for building the function and a <strong>holdout</strong> sample for testing classification accuracy.",
    } },

  { key: /Assumptions in MANOVA include _+, equality of variance, interdependence/i,
    set: {
      questionZh: "MANOVA 的假設包括 ______、變異數相等、觀察值獨立、依變數之間的線性與多元共線性，以及對離群值的敏感性。",
      explanationZh: "<strong>常態性（normality）</strong>是 MANOVA 的核心假設之一。除了常態性外，還需檢驗變異數齊性、觀察值獨立性、線性關係、多元共線性與離群值影響。",
      explanationEn: "<strong>Normality</strong> is a key assumption of MANOVA. Other assumptions include equality of variance-covariance matrices, independence of observations, linearity, multicollinearity among dependent variables, and sensitivity to outliers.",
    } },

  { key: /involves correlating each of original observed dependent variables directly with the independent canonical variate/i,
    set: {
      questionZh: "______ 是將每個原始觀測的依變數直接與自變數的 canonical variate 進行相關分析，反之亦然。",
      explanationZh: "<strong>Canonical cross-loadings</strong> 是將每個原始觀測變數直接與對面那組的 canonical variate 進行相關，可以更直接地解讀各變數在典型相關中的貢獻。",
      explanationEn: "<strong>Canonical cross-loadings</strong> involve correlating each original observed variable directly with the canonical variate of the opposite set, providing a more direct interpretation of variable contributions.",
    } },

  { key: /Three criteria could be used in conjunction with one another to decide which canonical/i,
    set: {
      questionZh: "可以同時使用三個準則來決定應解讀哪些 canonical functions：(1) 統計顯著性水準、(2) ______、(3) 冗餘量數（redundancy measure）。",
      explanationZh: "判斷 canonical function 是否值得解讀的三個準則：(1) 統計顯著性、(2) <strong>canonical correlation 的大小（magnitude of the canonical correlation）</strong>、(3) redundancy measure。",
      explanationEn: "Three criteria for deciding which canonical functions to interpret: (1) statistical significance, (2) <strong>magnitude of the canonical correlation</strong>, and (3) the redundancy measure for the percentage of variance accounted for.",
    } },

  { key: /Assumptions in MANOVA include _+, _+, independence of observations, linearity/i,
    set: {
      questionZh: "MANOVA 的假設包括 ______、______、觀察值獨立、依變數之間的線性與多元共線性，以及對離群值的敏感性。",
      explanationZh: "MANOVA 的主要假設包括：<strong>normality</strong>（常態性）、<strong>equality of variance</strong>（變異數齊性）、觀察值獨立性、線性關係、多元共線性與離群值影響。此題有兩個空格，依序是 normality 與 equality of variance。",
      explanationEn: "Key MANOVA assumptions include <strong>normality</strong> and <strong>equality of variance</strong> (homogeneity of variance-covariance matrices), along with independence, linearity, multicollinearity among DVs, and sensitivity to outliers.",
    } },

  // §五-18 — 3-blank technique/type/IV
  { key: /_+ is an appropriate technique when the dependent variable is _+ and the _+ are metric/i,
    set: {
      answers: ["Discriminant analysis", "nonmetric", "independent variables"],
      acceptedAnswers: [
        ["Discriminant analysis", "discriminant analysis"],
        ["nonmetric", "categorical", "categorical variable"],
        ["independent variables", "independent variable"],
      ], blankCount: 3,
      questionZh: "當依變數為 ______ 且 ______ 為計量變項時，______ 是適合的統計技術。",
    }, note: "categorical/nonmetric belongs to blank 2 only" },

  // ---- §二 restored standalone questions: exact answers + zh/explanation ----
  { key: /The purpose of a _+ design is to control for individual-level differences that may affect the within-group variance\.\s*$/i,
    set: {
      answers: ["repeated measures"], acceptedAnswers: [["repeated measures", "repeated measure"]], blankCount: 1,
      questionZh: "______ 設計的目的，是控制可能影響組內變異的個人層級差異。",
      explanationZh: "<strong>重複量數設計（repeated measures design）</strong>用來控制受試者本身的個體差異，降低組內變異，使研究者更容易觀察處理效果。",
      explanationEn: "A <strong>repeated measures design</strong> controls for individual-level differences by measuring the same respondents across conditions, reducing within-group variance.",
    } },

  { key: /respondent.?s lack of independence/i,
    set: {
      answers: ["repeated measures"], acceptedAnswers: [["repeated measures", "repeated measure"]], blankCount: 1,
      questionZh: "______ 設計的目的，是控制可能影響組內變異的個人層級差異。這是一種受試者之間缺乏獨立性的形式。",
      explanationZh: "<strong>重複量數（repeated measures）</strong>代表同一位受試者在不同條件或時間點被重複測量，因此觀察值並非完全獨立，但可控制個體差異。",
      explanationEn: "<strong>Repeated measures</strong> occur when the same respondents are measured more than once. This accounts for dependence among observations while controlling individual differences.",
    } },

  { key: /Approaches to assess the dependent variate in a MANOVA include Bonferroni inequality/i,
    set: {
      answers: ["Discriminant analysis"],
      acceptedAnswers: [["Discriminant analysis", "Stepdown analysis", "discriminant analysis", "stepdown analysis"]], blankCount: 1,
      sourceLabels: ["Exercise_Ch6", "2023"], years: ["2023"],
      questionZh: "在 MANOVA 中，用來評估依變量組合的方法包括 Bonferroni inequality 與 ______。",
      explanationZh: "MANOVA 中常見的依變量組合評估方法包括 <strong>Bonferroni inequality</strong>、<strong>discriminant analysis</strong> 與 <strong>stepdown analysis</strong>。不同年份題庫可能將此空格答案寫成 Discriminant analysis 或 Stepdown analysis，因此兩者都應接受。",
      explanationEn: "Approaches for assessing the dependent variate in MANOVA include <strong>Bonferroni inequality</strong>, <strong>discriminant analysis</strong>, and <strong>stepdown analysis</strong>. Because the exam bank uses both variants, both should be accepted.",
    } },

  { key: /specifies the groups to be compared through a _+\.\s*$/i,
    set: {
      answers: ["contrast"], acceptedAnswers: [["contrast", "contrast analysis", "planned comparison", "prior planned comparison"]], blankCount: 1,
      questionZh: "為了進一步辨識 MANOVA 中各個群體之間的差異，研究者通常會透過 ______ 指定要比較的群體。",
      explanationZh: "<strong>contrast</strong> 是研究者事先指定要比較哪些群體平均數的一種方式，用於進一步檢定個別群體間的差異。",
      explanationEn: "A <strong>contrast</strong> specifies which group means should be compared, allowing researchers to test planned comparisons among individual groups.",
    } },

  { key: /The objective of the _+ is to eliminate any effects/i,
    set: {
      answers: ["covariate"], acceptedAnswers: [["covariate", "covariates"]], blankCount: 1,
      questionZh: "______ 的目的，是排除那些只影響部分受試者，且會在受試者之間產生差異的效果。",
      explanationZh: "<strong>共變量（covariate）</strong>可用來控制受試者之間的差異，排除部分受試者特有或在受試者間變動的影響，以降低偏誤。",
      explanationEn: "A <strong>covariate</strong> helps eliminate effects that affect only some respondents or vary across respondents, thereby controlling for systematic differences.",
    } },

  { key: /In any univariate ANOVA design, metric independent variables, referred to as/i,
    set: {
      answers: ["covariates"], acceptedAnswers: [["covariates", "covariate"]], blankCount: 1,
      questionZh: "在任何單變量 ANOVA 設計中，都可以加入稱為 ______ 的計量型自變項，此時該設計稱為共變數分析 ANCOVA。",
      explanationZh: "在 ANOVA 中加入計量型自變項時，這些變項稱為 <strong>covariates</strong>。加入 covariates 後，分析就成為 <strong>ANCOVA</strong>。",
      explanationEn: "In a univariate ANOVA design, metric independent variables can be included as <strong>covariates</strong>. When covariates are included, the design is called <strong>ANCOVA</strong>.",
    } },

  // ---- multi-blank questionZh fixes (ensure zh has same blank count as en) ----
  { key: /Discriminant analysis is an appropriate statistical technique when the dependent variable is a _+ variable.*and the independent variables are _+ variables/i,
    set: { questionZh: "當依變數為 ______ 變項，且自變數為 ______ 變項時，判別分析是適合的統計技術。" } },

  { key: /the overall sample size should reach the ratio of _+ observations for each predictor.*at least _+ cases per group/i,
    set: { questionZh: "在判別分析中，整體樣本量應達到每個預測變項 ______ 個觀測值的比例，且每組至少應有 ______ 個案例。" } },

  { key: /To apply discriminant analysis.*these groups must be _+ and _+/i,
    set: { questionZh: "應用判別分析時，依變數群體數量可以是兩個以上，但這些群體必須是 ______ 且 ______。" } },

  { key: /Discriminant analysis is quite sensitive to the ratio of sample size.*suggest a ratio of _+ observations.*minimum.*is _+ observations per independent/i,
    set: { questionZh: "判別分析對樣本量與預測變項數量的比例很敏感。許多研究建議每個預測變項對應 ______ 個觀測值，建議最低為每個自變數 ______ 個觀測值。" } },

  { key: /Assumptions in multiple regression analysis include _+,\s*_+ of the error terms, independence/i,
    set: { questionZh: "多元迴歸分析的假設包括 ______、誤差項的 ______、誤差項的獨立性，以及誤差項分佈的常態性。" } },

  { key: /Two methods to assess the dependent variate are _+ and _+/i,
    set: { questionZh: "評估依變量組合的兩種方法為 ______ 與 ______。" } },

  { key: /Post hoc methods to identify differences between individual groups include _+,\s*_+.*and _+/i,
    set: { questionZh: "識別個別群體差異的事後比較方法包括 ______、______ 與 ______。" } },
];

export function applyCorrections(questions: Question[]): { questions: Question[]; applied: string[] } {
  const applied: string[] = [];
  const out = questions.map((q) => {
    const stem = n(q.questionEn);
    let mq = q;
    for (const c of CORRECTIONS) {
      if (!c.key.test(stem)) continue;
      if (c.when && !c.when(mq)) continue;
      mq = { ...mq, ...c.set, canonicalQuestion: mq.canonicalQuestion };
      applied.push(`${c.key.source.slice(0, 38)}… ✓`);
    }
    return mq;
  });
  return { questions: out, applied };
}
