/**
 * Icon set — Phosphor (regular weight) per design guideline §6.
 *
 * All non-mascot icons resolve to a single Phosphor glyph. The wrapper
 * preserves the existing API (`React.HTMLAttributes<HTMLSpanElement>` +
 * className-based sizing such as `text-xl`) so callers don't change —
 * Phosphor's SVG defaults to `size="1em"`, inheriting font-size.
 *
 * Two custom SVGs are kept:
 *  - `CleverMonkeyIcon` and `ExitedMonkeyIcon` are brand mascots.
 *  - `PanelLeftCloseIcon` / `PanelRightCloseIcon` are layout-specific
 *    panel toggle glyphs not found in Phosphor.
 */

import * as React from 'react';
import {
    ChatCircle, ClipboardText, Cards, TreeStructure, Presentation, Headphones,
    SquaresFour, WarningCircle, House, List, X, Plus, UploadSimple,
    CaretDown, CaretUp, CaretLeft, CaretRight, Check, Trash, PencilSimple,
    MagnifyingGlass, SignOut, User, Gear, Lightbulb, MagnifyingGlassPlus,
    MagnifyingGlassMinus, Copy, DownloadSimple, Eye, EyeSlash, Microphone,
    Folder, FolderOpen, FolderPlus, FilePdf, Image, FileText, DotsThreeVertical,
    Brain, ArrowsOutSimple, MagicWand, Lightning, Lock, CaretDoubleLeft,
    CaretDoubleRight, Cloud, Key, Prohibit, Star, TrendUp, ChartBar, Crown,
    ShieldCheck, Question, HardDrives, Warning, NotePencil, NoteBlank,
    Highlighter, Pause, Play, Stop, ArrowsClockwise, UsersThree, FileImage,
    PaperPlaneTilt, type Icon as PhosphorIcon,
} from '@phosphor-icons/react';

type IconProps = React.HTMLAttributes<HTMLSpanElement> & { title?: string };

const wrap = (Glyph: PhosphorIcon): React.FC<IconProps> => {
    const Wrapped: React.FC<IconProps> = ({ className, style, title, ...rest }) => (
        <Glyph
            weight="regular"
            className={className}
            style={style}
            aria-label={title}
            aria-hidden={title ? undefined : true}
            {...(rest as Record<string, unknown>)}
        />
    );
    Wrapped.displayName = `${Glyph.displayName || 'Icon'}Wrapped`;
    return Wrapped;
};

// ─── Phosphor-mapped icons ──────────────────────────────────────────────
export const ChatIcon              = wrap(ChatCircle);
export const AssignmentIcon        = wrap(ClipboardText);
export const StyleIcon             = wrap(Cards);
export const AccountTreeIcon       = wrap(TreeStructure);
export const SlideshowIcon         = wrap(Presentation);
export const HeadphonesIcon        = wrap(Headphones);
export const SpaceDashboardIcon    = wrap(SquaresFour);
export const ErrorOutlineIcon      = wrap(WarningCircle);
export const HomeIcon              = wrap(House);
export const MenuIcon              = wrap(List);
export const XIcon                 = wrap(X);
export const AddIcon               = wrap(Plus);
export const UploadIcon            = wrap(UploadSimple);
export const ChevronDownIcon       = wrap(CaretDown);
export const ChevronUpIcon         = wrap(CaretUp);
export const ChevronLeftIcon       = wrap(CaretLeft);
export const ChevronRightIcon      = wrap(CaretRight);
export const CheckIcon             = wrap(Check);
export const TrashIcon             = wrap(Trash);
export const EditIcon              = wrap(PencilSimple);
export const SearchIcon            = wrap(MagnifyingGlass);
export const LogOutIcon            = wrap(SignOut);
export const PersonIcon            = wrap(User);
export const SettingsIcon          = wrap(Gear);
export const LightbulbIcon         = wrap(Lightbulb);
export const ZoomInIcon            = wrap(MagnifyingGlassPlus);
export const ZoomOutIcon           = wrap(MagnifyingGlassMinus);
export const CopyIcon              = wrap(Copy);
export const DownloadIcon          = wrap(DownloadSimple);
export const PreviewIcon           = wrap(Eye);
export const VisibilityOffIcon     = wrap(EyeSlash);
export const MicrophoneIcon        = wrap(Microphone);
export const FolderIcon            = wrap(Folder);
export const FolderOpenIcon        = wrap(FolderOpen);
export const FolderPlusIcon        = wrap(FolderPlus);
export const PictureAsPdfIcon      = wrap(FilePdf);
export const ImageIcon             = wrap(Image);
export const TextSnippetIcon       = wrap(FileText);
export const DocumentIcon          = wrap(FileText);
export const MoreVertIcon          = wrap(DotsThreeVertical);
export const BrainIcon             = wrap(Brain);
export const FitScreenIcon         = wrap(ArrowsOutSimple);
export const AutoAwesomeIcon       = wrap(MagicWand);
export const BoltIcon              = wrap(Lightning);
export const LockIcon              = wrap(Lock);
export const DoubleChevronLeftIcon = wrap(CaretDoubleLeft);
export const DoubleChevronRightIcon= wrap(CaretDoubleRight);
export const CloudIcon             = wrap(Cloud);
export const KeyIcon               = wrap(Key);
export const BlockIcon             = wrap(Prohibit);
export const StarIcon              = wrap(Star);
export const TrendingUpIcon        = wrap(TrendUp);
export const BarChartIcon          = wrap(ChartBar);
export const WorkspacePremiumIcon  = wrap(Crown);
export const AdminPanelIcon        = wrap(ShieldCheck);
export const QuizIcon              = wrap(Question);
export const StorageIcon           = wrap(HardDrives);
export const WarningIcon           = wrap(Warning);
export const AnnotationIcon        = wrap(NotePencil);
export const NoteIcon              = wrap(NoteBlank);
export const HighlightIcon         = wrap(Highlighter);
export const PauseIcon             = wrap(Pause);
export const PlayArrowIcon         = wrap(Play);
export const StopIcon              = wrap(Stop);
export const RefreshIcon           = wrap(ArrowsClockwise);
export const PeopleIcon            = wrap(UsersThree);
export const SendIcon              = wrap(PaperPlaneTilt);
// Legacy alias — points to same glyph
export const PanelCloseIcon        = wrap(CaretDoubleLeft);
export const PanelOpenIcon         = wrap(CaretDoubleRight);
// Used by a couple of components for the file-type avatar
export const FileImageIcon         = wrap(FileImage);

// ─── Custom layout panel toggles (kept; not in Phosphor) ────────────────
export const PanelLeftCloseIcon: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({ className, ...props }) => (
    <span className={className} {...props} style={{ display: 'inline-flex', alignItems: 'center', ...((props as { style?: React.CSSProperties }).style) }}>
        <svg width="1em" height="1em" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="2" y="3" width="6" height="14" rx="1.5" fill="currentColor" opacity="0.9"/>
            <rect x="9.5" y="3" width="8.5" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
    </span>
);

export const PanelRightCloseIcon: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({ className, ...props }) => (
    <span className={className} {...props} style={{ display: 'inline-flex', alignItems: 'center', ...((props as { style?: React.CSSProperties }).style) }}>
        <svg width="1em" height="1em" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="12" y="3" width="6" height="14" rx="1.5" fill="currentColor" opacity="0.9"/>
            <rect x="2" y="3" width="8.5" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
    </span>
);

// ─── Mascots (brand assets, not the icon set) ───────────────────────────
export const CleverMonkeyIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
        width="100%" viewBox="240 280 480 460" enableBackground="new 0 0 1024 1024" xmlSpace="preserve" {...props}>
    <path fill="currentColor"
        d="
    M446.812195,295.659790
        C459.668457,291.417816 472.238007,287.855530 485.748444,289.001160
        C478.550903,294.526947 471.208191,299.472778 466.044128,307.263306
        C488.942719,300.721954 511.701721,296.060547 535.194214,303.305237
        C529.188049,305.971161 522.572266,306.288788 515.849915,309.415009
        C521.989136,310.893372 527.275024,312.027100 532.484253,313.442902
        C570.274475,323.713501 599.554199,345.903137 621.801086,377.726227
        C624.163269,381.105194 626.145630,382.411530 630.570862,381.975830
        C656.061096,379.466217 677.248779,396.246246 683.207214,423.158875
        C687.674561,443.336853 684.995728,462.554169 675.028442,480.645599
        C673.215149,483.936890 673.583435,485.487152 677.012817,487.114227
        C686.026184,491.390625 693.528259,497.694580 699.862427,505.378387
        C701.107971,506.889252 702.584839,508.316772 702.918640,511.128967
        C696.445129,511.363831 690.047302,507.283264 683.047852,510.900787
        C698.034851,520.043030 707.205200,532.793579 710.012756,551.372559
        C703.706421,547.456299 698.892883,542.777649 690.702026,541.100647
        C703.088318,557.612183 707.440796,574.518555 701.732361,594.274048
        C697.591614,589.107178 696.582764,583.150208 692.145874,579.000000
        C690.021423,582.424927 690.478943,586.162170 689.837708,589.605835
        C685.153992,614.757141 672.974121,636.154968 656.377869,655.103760
        C628.108459,687.380249 593.078674,708.827515 551.202454,718.599609
        C508.718231,728.513611 466.357727,728.504456 424.494385,715.272278
        C397.360809,706.695923 373.812256,691.857849 352.960754,672.608826
        C351.537170,671.294617 350.345703,669.549683 347.824402,669.159668
        C346.341980,675.399719 347.791473,681.571655 347.673431,688.037231
        C336.385010,679.543274 330.779053,667.610657 327.329681,653.655762
        C323.528473,658.860046 322.743103,664.404785 319.959595,669.452759
        C313.888092,657.942444 313.127930,645.512939 313.936188,632.902466
        C310.576538,630.881958 306.946899,631.098389 303.579956,630.453308
        C267.658142,623.571655 246.560501,585.179077 246.543152,561.479187
        C246.525345,537.166199 256.090393,518.684204 277.443085,506.740540
        C280.787964,504.869507 280.931915,502.298340 280.785065,499.206726
        C279.529175,472.762512 283.482758,447.122345 292.625397,422.270935
        C295.680115,413.967651 298.852356,405.679565 303.932190,398.404419
        C312.062347,386.760742 314.313141,372.477051 321.534393,360.417145
        C326.265961,352.515228 331.238342,344.877380 337.735992,338.322296
        C338.946411,337.101135 339.860474,335.243378 342.611542,335.568146
        C342.547760,341.304718 339.055084,346.659637 340.498962,352.585754
        C342.974854,352.717590 343.802551,350.565308 345.113983,349.264191
        C355.510223,338.949707 364.453156,327.199402 376.106171,318.119354
        C381.913696,313.594147 388.142609,309.759216 394.589478,306.258148
        C395.969269,305.508850 397.395355,304.350250 399.743896,305.579285
        C397.983673,310.815582 394.306580,315.330658 392.964539,321.362854
        C396.153778,321.155151 398.439087,319.575226 400.796265,318.274506
        C415.662933,310.070801 430.180756,301.162903 446.812195,295.659790
    M506.679962,512.111511
        C522.579956,503.104706 539.554688,497.354431 557.884094,496.900543
        C578.800171,496.382599 597.762573,503.355042 615.666382,513.644348
        C617.336426,514.604126 618.769409,516.270264 621.087097,515.848877
        C623.169922,513.562500 623.974854,510.653687 624.922424,507.826874
        C630.383667,491.534546 631.337952,474.813538 628.590515,458.005920
        C624.905151,435.460144 616.031250,415.076324 599.624329,398.861359
        C586.981567,386.366455 571.720642,378.968445 553.421570,383.412567
        C535.099915,387.862183 523.563660,400.752625 515.496643,417.100128
        C512.109436,423.964264 512.295593,423.925720 505.519135,420.176086
        C486.862427,409.852875 467.102417,404.171539 445.627991,407.403564
        C423.785156,410.691010 406.144928,421.060577 394.127747,439.976135
        C383.485107,456.728058 380.069763,475.070770 383.270447,494.552277
        C389.054901,529.760254 406.683350,557.104980 437.768005,575.260071
        C443.522339,578.620911 443.491943,578.382507 446.857727,572.706848
        C461.638367,547.783020 480.489807,526.830933 506.679962,512.111511
    M635.020813,541.479858
        C626.937378,532.634827 617.085632,526.069763 606.822083,520.163147
        C581.739075,505.728149 555.369019,501.976410 528.260742,513.340637
        C494.229614,527.607056 468.839661,551.670410 452.622833,584.831665
        C444.021454,602.420410 441.567261,621.043518 447.751740,640.148499
        C456.734589,667.898071 476.747589,684.138428 503.644989,692.690430
        C526.353882,699.910706 549.253601,698.863037 572.062439,692.711548
        C602.682800,684.453491 627.364624,667.622864 645.281738,641.358826
        C657.483093,623.473328 663.317749,603.884094 658.636963,582.182434
        C655.232910,566.400146 646.426392,553.544067 635.020813,541.479858
    M327.845276,539.221619
        C328.490509,534.345215 327.040436,530.649536 322.714111,527.754272
        C302.415558,514.170044 275.674835,524.326904 269.308502,547.942444
        C263.916107,567.945251 277.013763,593.536865 294.143463,603.761902
        C308.954559,612.602844 324.241150,613.748108 339.968292,606.569580
        C341.901398,605.687195 345.422546,605.267517 344.015869,601.529846
        C342.869873,598.484802 341.467407,595.536255 340.120148,592.409119
        C338.635162,593.057678 337.722687,593.426880 336.834961,593.848206
        C324.573883,599.667786 312.663910,595.674194 306.624817,583.474060
        C302.802277,575.751770 300.349396,567.699707 302.332947,558.890747
        C303.192413,555.073730 301.256775,554.003174 297.832153,554.800842
        C293.334595,555.848450 290.262970,558.764221 287.755524,562.479614
        C286.723663,564.008667 286.216888,566.166565 283.922729,566.602051
        C281.376129,559.947693 284.728149,548.873291 291.621368,543.872498
        C305.084656,534.105408 316.959930,539.083435 328.205292,549.542358
        C328.869202,545.865051 328.375397,542.961182 325.000000,540.000000z"/>
    <path fill="currentColor"
        d="
    M444.540314,522.819580
        C434.427887,516.855164 429.378510,507.075409 431.082123,497.258057
        C433.000000,486.206055 440.509125,478.245972 451.004852,476.138916
        C459.495239,474.434418 470.436646,478.936066 475.137817,486.068115
        C480.760406,494.598083 480.836884,506.065308 475.326599,514.384644
        C469.888672,522.594849 460.391571,526.679138 451.128876,524.713196
        C449.021759,524.265930 446.967285,523.570557 444.540314,522.819580
    M448.933289,486.505066
        C443.328125,484.580475 439.049377,486.542603 438.336121,491.469757
        C437.734772,495.624084 439.531952,498.544067 443.389496,500.085297
        C446.825348,501.458038 449.711578,500.226196 451.556152,497.327820
        C454.042786,493.420441 453.344971,489.783691 448.933289,486.505066
    z"/>
    <path fill="currentColor"
        d="
    M581.428711,457.791260
        C591.973572,456.914307 600.743225,459.176636 606.568848,468.321716
        C607.736877,470.155304 608.863342,471.995483 608.524719,474.370728
        C606.558594,476.050537 604.684692,474.532288 602.937317,474.027466
        C587.740173,469.637085 574.826782,474.355835 563.037048,483.782440
        C561.808838,484.764496 560.928833,486.958801 559.015503,485.996429
        C556.736389,484.850037 557.508057,482.398651 557.974915,480.614990
        C561.138000,468.529266 568.196289,460.260132 581.428711,457.791260
    z"/>
    <path fill="currentColor"
        d="
    M497.536255,605.500916
        C520.951660,607.851074 543.844360,607.548279 566.489929,602.638672
        C586.590881,598.280762 606.090027,592.213989 623.418091,580.625916
        C625.075562,579.517517 626.581055,578.184143 628.213440,577.035461
        C629.770813,575.939575 630.602539,573.703735 633.280029,573.897949
        C635.160400,576.042114 633.879456,578.222168 632.956909,580.218628
        C629.620789,587.438354 624.104553,592.663940 617.233765,596.433960
        C613.936340,598.243408 612.648560,600.357178 612.990173,604.381531
        C614.421875,621.246582 611.627563,637.371033 601.867065,651.528564
        C589.848389,668.961731 572.317566,675.499451 551.933655,673.749451
        C518.329163,670.864258 496.876068,650.363647 480.801025,622.686523
        C479.488586,620.426819 478.819611,617.745483 476.668823,615.976746
        C474.289215,616.574951 473.851013,618.708679 472.871155,620.361267
        C471.954620,621.907166 471.885620,623.900818 470.406403,625.160767
        C465.501892,621.729919 465.475525,611.053772 470.383667,604.046814
        C476.358307,595.517151 488.367401,590.590271 494.829590,596.470093
        C493.900970,599.890686 489.555908,599.700806 487.966797,602.926208
        C490.500793,605.495422 494.178497,604.277100 497.536255,605.500916
    M513.983582,639.350342
        C511.184387,640.930664 510.418060,642.592590 513.314453,645.008179
        C522.526794,652.691162 532.624756,658.712891 544.460815,661.213135
        C559.184937,664.323547 572.889099,662.134338 585.016541,652.606506
        C587.683167,650.511475 588.053467,648.825562 585.497620,646.188416
        C579.406372,639.903442 572.197876,635.654175 563.753479,633.638306
        C560.835510,632.941650 557.640564,632.271179 554.781677,634.064941
        C555.318787,638.505737 560.519165,640.797363 559.482483,646.405273
        C545.391296,636.750793 530.970398,631.504333 513.983582,639.350342
    z"/>
    <path fill="currentColor"
        d="
    M527.916809,533.396240
        C539.310486,531.481445 553.036133,537.175720 557.984314,545.744568
        C555.692322,548.769714 552.073792,548.881836 548.800659,549.679443
        C541.923523,551.355347 535.033142,552.041016 528.207764,549.429504
        C526.821228,548.899048 525.382324,548.366760 524.175598,547.533875
        C521.661194,545.798462 519.298401,543.723938 519.805054,540.267395
        C520.436523,535.959534 523.886292,534.565979 527.916809,533.396240
    z"/>
    <path fill="currentColor"
        d="
    M577.247559,516.791992
        C581.118774,515.000977 584.465820,515.197754 587.217224,518.032104
        C589.971313,520.869263 589.832764,524.364624 588.564636,527.802612
        C586.059021,534.595337 580.953674,538.907959 574.585022,541.882690
        C572.356689,542.923584 570.344238,542.334473 570.172241,539.734375
        C569.619324,531.372253 569.561401,523.050415 577.247559,516.791992
    z"/>
</svg>
);

export const ExitedMonkeyIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="240 280 480 460" {...props}>
        <path fill="currentColor" d="M482 322c64 0 132 28 162 102 14 36 16 78 0 132-22 76-94 142-188 142-122 0-208-86-216-180-6-78 48-188 188-196 24-2 36 0 54 0z M460 488c-22 22-12 60 12 60 24 0 38-30 24-54-10-18-28-16-36-6z M550 488c-22 22-12 60 12 60 24 0 38-30 24-54-10-18-28-16-36-6z" />
    </svg>
);
