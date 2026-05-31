// Fix: Use namespace import for React to resolve JSX intrinsic element errors.
import * as React from 'react';

// Helper function to create a Material Symbols icon component.
const createIcon = (iconName: string): React.FC<React.HTMLAttributes<HTMLSpanElement>> => {
    const IconComponent: React.FC<React.HTMLAttributes<HTMLSpanElement>> = (props) => {
        const { className, ...rest } = props;
        const combinedClassName = `material-symbols-rounded ${className || ''}`;
        return (
            <span {...rest} className={combinedClassName}>
                {iconName}
            </span>
        );
    };
    IconComponent.displayName = `Icon(${iconName})`;
    return IconComponent;
};

// Fix: Export all required icons using the createIcon helper.
export const DocumentIcon = createIcon('article');
export const MenuIcon = createIcon('menu');
export const XIcon = createIcon('close');
export const UploadIcon = createIcon('upload_file');
export const ChevronDownIcon = createIcon('expand_more');
export const ChevronUpIcon = createIcon('expand_less');
export const LightbulbIcon = createIcon('lightbulb');
export const ZoomInIcon = createIcon('zoom_in');
export const ZoomOutIcon = createIcon('zoom_out');
export const ChatIcon = createIcon('forum');
export const CopyIcon = createIcon('content_copy');
export const DownloadIcon = createIcon('download');
export const PreviewIcon = createIcon('visibility');
export const VisibilityOffIcon = createIcon('visibility_off');
export const AssignmentIcon = createIcon('assignment');
export const BrainIcon = createIcon('psychology');
export const AddIcon = createIcon('add');
export const FolderPlusIcon = createIcon('create_new_folder');
export const DoubleChevronLeftIcon = createIcon('keyboard_double_arrow_left');
export const DoubleChevronRightIcon = createIcon('keyboard_double_arrow_right');
export const PanelCloseIcon = createIcon('panel_close');
export const PanelOpenIcon = createIcon('panel_open');
export const MicrophoneIcon = createIcon('mic');
export const FolderIcon = createIcon('folder');
export const ChevronLeftIcon = createIcon('chevron_left');
export const ChevronRightIcon = createIcon('chevron_right');
export const EditIcon = createIcon('edit');
export const TrashIcon = createIcon('delete');
export const CheckIcon = createIcon('check');
export const FitScreenIcon = createIcon('fit_screen');
export const HighlightIcon = createIcon('ink_highlighter');
export const NoteIcon = createIcon('sticky_note_2');
export const MoreVertIcon = createIcon('more_vert');
export const LogOutIcon = createIcon('logout');
export const PersonIcon = createIcon('person');
export const SettingsIcon = createIcon('settings');
export const StyleIcon = createIcon('style');
export const ErrorOutlineIcon = createIcon('error_outline');
export const HomeIcon = createIcon('home');
export const AccountTreeIcon = createIcon('account_tree');
export const SlideshowIcon = createIcon('slideshow');
export const HeadphonesIcon = createIcon('headphones');
export const PlayArrowIcon = createIcon('play_arrow');
export const PauseIcon = createIcon('pause');
export const StopIcon = createIcon('stop');
export const AutoAwesomeIcon = createIcon('auto_awesome');
export const SearchIcon = createIcon('search');
export const PictureAsPdfIcon = createIcon('picture_as_pdf');
export const ImageIcon = createIcon('image');
export const TextSnippetIcon = createIcon('text_snippet');
export const RefreshIcon = createIcon('refresh');
export const AdminPanelIcon = createIcon('admin_panel_settings');
export const PeopleIcon = createIcon('people');
export const WorkspacePremiumIcon = createIcon('workspace_premium');
export const TrendingUpIcon = createIcon('trending_up');
export const BlockIcon = createIcon('block');
export const StarIcon = createIcon('star');
export const KeyIcon = createIcon('key');
export const BoltIcon = createIcon('bolt');
export const LockIcon = createIcon('lock');
export const StorageIcon = createIcon('storage');
export const BarChartIcon = createIcon('bar_chart');
export const WarningIcon = createIcon('warning');
export const QuizIcon = createIcon('quiz');
export const FolderOpenIcon = createIcon('folder_open');
export const AnnotationIcon = createIcon('edit_note');
export const CloudIcon = createIcon('cloud');
export const SpaceDashboardIcon = createIcon('space_dashboard');

/**
 * CleverMonkey mascot — Duolingo-style.
 *
 * Built from simple geometric shapes (circles + arcs) for a friendly,
 * gamified feel. The body fills with `currentColor` so it picks up
 * brand tinting; face mask, eye whites, and pupils render in fixed
 * colors for personality and contrast.
 *
 * Use:  <CleverMonkeyIcon className="text-brand-500 w-16 h-16" />
 */
export const CleverMonkeyIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 120 120"
        width="100%"
        height="100%"
        fill="none"
        aria-hidden="true"
        {...props}
    >
        {/* Outer ears */}
        <circle cx="28" cy="38" r="14" fill="currentColor" opacity="0.85" />
        <circle cx="92" cy="38" r="14" fill="currentColor" opacity="0.85" />
        {/* Inner ear pads */}
        <circle cx="28" cy="38" r="7" fill="#FBE4D5" />
        <circle cx="92" cy="38" r="7" fill="#FBE4D5" />

        {/* Head — main circle */}
        <circle cx="60" cy="60" r="40" fill="currentColor" />

        {/* Face mask (lighter snout / heart-ish) */}
        <path
            d="M30 62 C30 50, 42 42, 60 42 C78 42, 90 50, 90 62 C90 78, 78 92, 60 92 C42 92, 30 78, 30 62 Z"
            fill="#FCE7D5"
        />

        {/* Eye whites */}
        <circle cx="46" cy="56" r="10" fill="#FFFFFF" />
        <circle cx="74" cy="56" r="10" fill="#FFFFFF" />

        {/* Pupils — slightly off-center for character */}
        <circle cx="48.5" cy="57.5" r="4.2" fill="#1E1B2E" />
        <circle cx="76.5" cy="57.5" r="4.2" fill="#1E1B2E" />

        {/* Sparkle highlights */}
        <circle cx="50" cy="55.5" r="1.4" fill="#FFFFFF" />
        <circle cx="78" cy="55.5" r="1.4" fill="#FFFFFF" />

        {/* Cheeks */}
        <circle cx="40" cy="72" r="3.5" fill="#F8B4A8" opacity="0.7" />
        <circle cx="80" cy="72" r="3.5" fill="#F8B4A8" opacity="0.7" />

        {/* Nose */}
        <ellipse cx="60" cy="68" rx="2.4" ry="1.6" fill="#1E1B2E" opacity="0.55" />

        {/* Smile */}
        <path
            d="M52 74 Q60 82, 68 74"
            stroke="#1E1B2E"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
        />
    </svg>
);

export const PanelLeftCloseIcon: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({ className, ...props }) => (
  <span className={className} {...props} style={{ display: 'inline-flex', alignItems: 'center', ...((props as React.HTMLAttributes<HTMLSpanElement> & { style?: React.CSSProperties }).style) }}>
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="3" width="6" height="14" rx="1.5" fill="currentColor" opacity="0.9"/>
      <rect x="9.5" y="3" width="8.5" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  </span>
);

export const PanelRightCloseIcon: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({ className, ...props }) => (
  <span className={className} {...props} style={{ display: 'inline-flex', alignItems: 'center', ...((props as React.HTMLAttributes<HTMLSpanElement> & { style?: React.CSSProperties }).style) }}>
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="3" width="8" height="14" rx="1.5" fill="currentColor" opacity="0.9"/>
      <rect x="2" y="3" width="8.5" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  </span>
);

export const ExitedMonkeyIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
	 width="100%" viewBox="260 260 500 500" enableBackground="new 0 0 1024 1024" xmlSpace="preserve" {...props}>
    <path fill="currentColor"
        d="
    M487.951477,724.264771 
        C468.918152,720.932068 450.767761,716.205383 433.846161,707.511719 
        C426.874817,703.930054 420.022552,700.164062 413.742981,695.430542 
        C412.593933,694.564392 411.309723,693.877686 409.696838,692.861816 
        C408.410370,700.099365 412.533051,705.737976 413.796967,713.472412 
        C401.680206,707.068115 393.536255,698.270508 386.617676,688.119812 
        C379.678925,677.939453 375.838379,666.455566 372.743164,653.378479 
        C367.844574,662.504028 368.453766,671.536194 367.509888,680.214600 
        C364.374512,680.020569 363.873260,677.813782 362.998840,676.185181 
        C357.181488,665.350586 353.378754,653.883362 352.677643,641.530334 
        C352.472382,637.914307 351.196747,636.134338 347.195465,636.279541 
        C303.422363,637.867188 270.637207,602.113159 269.247955,560.435303 
        C268.455505,536.661560 279.904968,518.555908 300.941498,507.181702 
        C305.270782,504.840912 306.582214,502.758026 306.271820,497.703522 
        C304.967072,476.458130 306.967255,455.383240 313.390625,435.053772 
        C316.308594,425.818787 316.459137,416.858154 315.325409,407.540741 
        C314.180634,398.132324 313.814270,388.692841 315.210602,378.070282 
        C320.734192,384.027130 322.724518,391.352966 328.424438,397.046478 
        C331.632751,376.094055 336.699829,356.289856 350.585602,339.867340 
        C350.455780,347.702148 349.806793,355.390533 350.527100,364.913422 
        C376.344879,324.703217 408.532623,293.062927 448.868286,269.773560 
        C443.769562,280.206787 438.071136,290.180206 436.006683,301.892059 
        C461.922760,279.883240 491.627838,266.675598 525.125916,261.477783 
        C515.466980,270.572479 505.095398,278.776062 499.098114,291.169495 
        C512.609802,285.814941 526.152893,280.968170 540.505371,279.034729 
        C554.835815,277.104187 569.117249,276.847992 583.350403,281.062439 
        C569.572571,286.813385 555.373169,291.468262 544.437622,302.692444 
        C546.896790,304.926483 549.670593,304.978088 552.150635,305.601227 
        C586.346191,314.193146 616.505066,329.967621 641.087708,355.606689 
        C649.064758,363.926514 656.096436,373.031830 662.021240,382.929321 
        C663.515869,385.426239 664.907654,386.443665 667.962341,385.647980 
        C692.874207,379.158997 715.794495,393.669525 724.156189,415.738159 
        C732.857117,438.702057 731.738342,461.377075 720.823242,483.473572 
        C720.459778,484.209351 720.119019,484.956360 719.474182,486.317993 
        C743.077515,502.254913 756.847778,524.120728 758.274292,553.208374 
        C751.347778,546.217163 745.304626,538.357544 735.848083,533.310852 
        C737.074097,540.320496 739.455017,546.362000 740.389160,552.760193 
        C743.161377,571.747192 739.762695,589.909729 733.445557,607.689880 
        C723.781677,634.889648 707.557983,657.864441 687.522705,678.343323 
        C685.789185,680.115234 683.953308,681.705078 683.229126,684.324829 
        C676.111877,710.072327 658.562378,726.015442 634.350525,735.215637 
        C604.450684,746.577209 574.507751,744.992249 545.214661,733.199036 
        C535.351807,729.228333 525.420288,727.906860 515.144165,727.378235 
        C506.151672,726.915649 497.261139,725.699219 487.951477,724.264771 
    M494.532227,392.115448 
        C491.391693,391.755402 488.252594,391.382141 485.110382,391.037415 
        C452.570770,387.467407 423.600189,404.582977 411.134949,434.745575 
        C402.938782,454.578064 401.510803,475.105225 405.412750,496.011169 
        C410.409027,522.780457 423.179749,544.571716 446.928589,559.101257 
        C449.532410,560.694336 451.438843,560.880554 454.012115,558.749451 
        C465.867981,548.930786 479.776733,545.248413 494.962280,545.795898 
        C496.991730,545.869080 499.151367,545.762451 501.309509,548.366211 
        C498.250122,549.195618 495.904175,549.835266 493.556274,550.467529 
        C462.090668,558.941467 445.514496,584.682373 450.507660,616.777893 
        C454.512573,642.520996 465.958496,664.419495 483.956329,682.991333 
        C489.213531,688.416199 494.801117,693.580322 501.506958,697.467651 
        C502.420349,695.609985 500.643005,694.166809 501.757172,692.800476 
        C502.755188,692.346375 503.392517,692.963989 503.916962,693.574951 
        C514.430908,705.821777 528.290100,713.029358 542.785889,719.184631 
        C567.846313,729.825684 593.682129,733.538391 620.393372,726.661377 
        C640.985962,721.359680 658.288513,711.196106 668.680969,691.705750 
        C674.908630,680.026184 676.214172,667.355225 675.946777,654.376160 
        C675.901672,652.186157 675.176147,649.772705 676.985840,647.502075 
        C680.485901,649.840149 679.635071,654.734253 683.039917,657.151062 
        C683.990112,655.801025 684.845703,654.788147 685.481140,653.652222 
        C695.629272,635.511719 704.132935,616.761353 706.072754,595.723145 
        C708.292480,571.648743 702.083435,550.500549 683.808228,533.807617 
        C680.791809,531.052368 677.210083,528.916016 673.889587,526.493713 
        C677.075500,531.779480 681.048584,536.073120 683.722412,541.301880 
        C686.476379,546.687500 686.178711,551.786377 682.423279,556.734924 
        C677.946838,562.633484 671.673523,566.082458 665.518066,569.739380 
        C663.530273,570.920227 661.230896,571.828308 660.696045,574.464661 
        C658.407776,585.743103 656.730042,597.036987 657.692261,608.646606 
        C658.917297,623.427429 662.154846,637.902527 663.862122,652.608643 
        C666.752930,677.508789 656.793152,696.729187 635.299072,706.079102 
        C621.695618,711.996582 607.442871,713.505737 592.750732,710.874084 
        C567.730652,706.392456 548.512756,692.297424 531.917419,674.058350 
        C511.796173,651.944031 498.116302,625.903992 486.793335,598.492615 
        C485.951355,596.455346 485.792786,593.973450 483.482391,592.647644 
        C478.944946,595.846375 479.086243,602.013489 475.053345,605.352051 
        C468.974762,598.552612 472.970276,583.802063 479.494781,577.394470 
        C487.027435,569.996948 499.656952,566.383179 505.535217,570.552368 
        C502.571686,574.452698 496.698425,575.205017 494.609924,580.222168 
        C495.381226,580.731140 495.883484,581.222168 496.483459,581.426636 
        C497.898804,581.908997 499.351990,582.289978 500.805084,582.650574 
        C526.178467,588.948z"
	/>
</svg>
)
