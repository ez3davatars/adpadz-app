import { forwardRef, useMemo } from 'react';
import * as QRCode from 'qrcode';
import type {
  QRCenterFrameShape,
  QROuterBackgroundFit,
  QROrnamentStyle,
  QROuterBackgroundType,
  QRRimBandBackgroundType,
  QRRimBandImageFit,
  QRRimDecoration,
  QRStylePreset,
} from '../../lib/qr/qrTypes';

type QRMatrix = {
  modules: {
    size: number;
    data: ArrayLike<boolean | number>;
  };
};

type CircularPadQRProps = {
  value: string;
  title?: string;
  topText?: string;
  bottomText?: string;
  centerLabel?: string;
  shortLabel?: string;
  preset?: QRStylePreset;
  foregroundColor?: string;
  backgroundColor?: string;
  accentColor?: string;
  showCenterLabel?: boolean;
  showShortLabel?: boolean;
  logoDataUrl?: string;
  centerFrameShape?: QRCenterFrameShape;
  centerFrameStrokeColor?: string;
  centerFrameFillColor?: string;
  rimDecoration?: QRRimDecoration;
  rimBandColor?: string;
  rimTextColor?: string;
  innerFieldColor?: string;
  outerBorderColor?: string;
  outerBackgroundType?: QROuterBackgroundType;
  outerBackgroundColor?: string;
  outerBackgroundImageDataUrl?: string;
  outerBackgroundImageOpacity?: number;
  outerBackgroundImageFit?: QROuterBackgroundFit;
  outerBackgroundOverlayColor?: string;
  rimBandBackgroundType?: QRRimBandBackgroundType;
  rimBandImageDataUrl?: string;
  rimBandImageOpacity?: number;
  rimBandImageFit?: QRRimBandImageFit;
  rimBandOverlayColor?: string;
  rimBandOverlayOpacity?: number;
  ornamentStyle?: QROrnamentStyle;
  ornamentMainColor?: string;
  ornamentAccentColor?: string;
  ornamentShadowColor?: string;
  ornamentOpacity?: number;
  size?: number;
  className?: string;
};

const VIEWBOX_SIZE = 2000;
const DEFAULT_VALUE = 'https://adpadz.co/q/demo';

function isFinderModule(row: number, column: number, matrixSize: number): boolean {
  const inTop = row < 7;
  const inBottom = row >= matrixSize - 7;
  const inLeft = column < 7;
  const inRight = column >= matrixSize - 7;

  return (inTop && inLeft) || (inTop && inRight) || (inBottom && inLeft);
}


type PremiumWaveOrnamentProps = {
  mainColor: string;
  accentColor: string;
  shadowColor: string;
};

const TOP_DARK_PATHS: string[] = [
  'M 1006.4 523.1 L 1031.9 496.0 L 1060.6 476.9 L 1087.7 465.7 L 1119.6 459.3 L 1143.5 459.3 L 1175.4 465.7 L 1261.6 504.0 L 1309.4 516.7 L 1358.9 518.3 L 1381.2 513.6 L 1406.7 502.4 L 1389.2 508.8 L 1360.4 512.0 L 1319.0 505.6 L 1272.7 484.8 L 1221.7 451.4 L 1194.6 438.6 L 1162.7 430.6 L 1126.0 430.6 L 1092.5 440.2 L 1070.2 451.4 L 1054.2 462.5 L 1025.5 489.6 L 1014.4 505.6 Z',
  'M 990.4 521.5 L 982.5 505.6 L 969.7 488.0 L 936.2 457.7 L 904.3 440.2 L 878.8 432.2 L 854.9 429.0 L 824.6 432.2 L 794.3 441.8 L 759.2 460.9 L 720.9 486.4 L 677.8 505.6 L 657.1 510.4 L 630.0 512.0 L 606.1 508.8 L 588.5 502.4 L 609.3 512.0 L 626.8 516.7 L 676.2 518.3 L 725.7 507.2 L 751.2 497.6 L 795.9 475.3 L 826.2 464.1 L 853.3 459.3 L 877.2 459.3 L 909.1 465.7 L 933.0 475.3 L 964.9 496.0 Z',
  'M 768.7 424.2 L 794.3 409.9 L 824.6 400.3 L 870.8 398.7 L 888.4 401.9 L 913.9 409.9 L 942.6 424.2 L 958.5 435.4 L 985.6 460.9 L 998.4 481.7 L 1012.8 459.3 L 1044.7 430.6 L 1079.7 411.5 L 1103.7 403.5 L 1126.0 398.7 L 1162.7 398.7 L 1194.6 406.7 L 1226.5 422.6 L 1194.6 403.5 L 1159.5 392.3 L 1111.6 390.7 L 1094.1 393.9 L 1070.2 401.9 L 1036.7 421.1 L 1019.1 437.0 L 998.4 468.9 L 980.9 440.2 L 960.1 421.1 L 926.6 401.9 L 894.7 392.3 L 848.5 390.7 L 824.6 395.5 L 799.0 405.1 Z',
  'M 998.4 354.1 L 993.6 365.2 L 984.1 374.8 L 971.3 382.8 L 950.6 387.6 L 964.9 393.9 L 980.9 405.1 L 995.2 419.5 L 998.4 425.8 L 1014.4 406.7 L 1031.9 393.9 L 1046.3 387.6 L 1035.1 386.0 L 1017.5 378.0 L 1004.8 366.8 Z',
];

const TOP_GREEN_PATHS: string[] = [
  'M 1264.8 459.3 L 1266.3 457.7 L 1266.3 464.1 L 1269.5 462.5 L 1275.9 470.5 L 1277.5 468.9 L 1291.9 480.1 L 1293.5 478.5 L 1314.2 489.6 L 1315.8 488.0 L 1336.5 496.0 L 1341.3 494.4 L 1352.5 497.6 L 1366.8 497.6 L 1379.6 494.4 L 1344.5 494.4 L 1331.7 489.6 L 1323.8 489.6 L 1293.5 476.9 Z',
  'M 1156.3 409.9 L 1173.8 413.1 L 1177.0 416.3 L 1180.2 414.7 L 1188.2 419.5 L 1207.3 424.2 L 1215.3 430.6 L 1220.1 430.6 L 1228.1 435.4 L 1229.7 438.6 L 1231.3 437.0 L 1234.4 441.8 L 1236.0 440.2 L 1245.6 446.6 L 1244.0 448.2 L 1248.8 448.2 L 1234.4 438.6 L 1231.3 433.8 L 1196.2 416.3 L 1178.6 411.5 L 1169.1 411.5 L 1165.9 408.3 Z',
  'M 886.8 409.9 L 891.5 408.3 L 888.4 408.3 L 886.8 413.1 L 897.9 414.7 L 926.6 427.4 L 941.0 438.6 L 950.6 441.8 L 963.3 456.1 L 961.7 457.7 L 964.9 457.7 L 977.7 470.5 L 976.1 472.1 L 979.3 472.1 L 998.4 502.4 L 1022.3 467.3 L 1028.7 460.9 L 1031.9 460.9 L 1043.1 448.2 L 1044.7 449.8 L 1043.1 448.2 L 1046.3 443.4 L 1059.0 433.8 L 1103.7 414.7 L 1098.9 413.1 L 1097.3 416.3 L 1090.9 416.3 L 1089.3 419.5 L 1079.7 422.6 L 1078.1 421.1 L 1078.1 424.2 L 1062.2 432.2 L 1060.6 430.6 L 1057.4 435.4 L 1046.3 440.2 L 1041.5 446.6 L 1038.3 446.6 L 1011.2 476.9 L 998.4 500.8 L 988.8 481.7 L 985.6 480.1 L 987.2 478.5 L 958.5 446.6 L 956.9 448.2 L 947.4 440.2 L 949.0 438.6 L 947.4 440.2 L 944.2 435.4 L 937.8 433.8 L 936.2 430.6 L 934.6 432.2 L 928.2 425.8 L 909.1 419.5 L 905.9 416.3 L 904.3 417.9 L 901.1 414.7 L 894.7 414.7 L 891.5 411.5 L 888.4 413.1 Z',
  'M 846.9 406.7 L 818.2 413.1 L 816.6 411.5 L 789.5 421.1 L 757.6 438.6 L 740.0 453.0 L 736.8 453.0 L 733.7 457.7 L 712.9 468.9 L 703.3 476.9 L 701.8 475.3 L 700.2 478.5 L 695.4 478.5 L 677.8 488.0 L 676.2 486.4 L 668.3 491.2 L 657.1 491.2 L 650.7 494.4 L 617.2 494.4 L 628.4 497.6 L 649.1 497.6 L 671.5 491.2 L 673.0 492.8 L 685.8 486.4 L 687.4 488.0 L 725.7 467.3 L 740.0 454.5 L 748.0 451.4 L 749.6 448.2 L 779.9 429.0 L 818.2 414.7 L 821.4 416.3 L 823.0 413.1 L 843.7 409.9 Z',
  'M 1081.3 381.2 L 1075.0 379.6 L 1057.4 386.0 L 1055.8 384.4 L 1031.9 395.5 L 1014.4 409.9 L 1006.4 422.6 L 1003.2 421.1 L 1004.8 424.2 L 998.4 433.8 L 990.4 419.5 L 974.5 401.9 L 949.0 387.6 L 936.2 382.8 L 934.6 384.4 L 928.2 381.2 L 920.3 381.2 L 945.8 387.6 L 955.3 392.3 L 956.9 395.5 L 961.7 395.5 L 988.8 419.5 L 998.4 437.0 L 1012.8 414.7 L 1035.1 395.5 L 1054.2 389.2 L 1060.6 384.4 L 1063.8 386.0 L 1065.4 382.8 L 1068.6 384.4 L 1071.8 381.2 Z',
];

const TOP_GRAY_PATHS: string[] = [
  'M 1382.8 526.3 L 1358.9 532.7 L 1344.5 532.7 L 1365.2 532.7 Z',
  'M 610.8 526.3 L 630.0 532.7 L 652.3 532.7 L 638.0 532.7 Z',
  'M 1014.4 539.1 L 1028.7 527.9 L 1059.0 512.0 L 1102.1 500.8 L 1159.5 502.4 L 1234.4 524.7 L 1283.9 535.9 L 1314.2 537.5 L 1315.8 532.7 L 1322.2 532.7 L 1307.8 532.7 L 1266.3 524.7 L 1178.6 492.8 L 1149.9 488.0 L 1114.8 488.0 L 1079.7 496.0 L 1054.2 507.2 L 1030.3 523.1 Z',
  'M 982.5 539.1 L 966.5 523.1 L 945.8 508.8 L 912.3 494.4 L 882.0 488.0 L 846.9 488.0 L 826.2 491.2 L 779.9 505.6 L 740.0 521.5 L 709.7 529.5 L 674.6 532.7 L 684.2 532.7 L 685.8 537.5 L 712.9 535.9 L 738.4 531.1 L 837.3 502.4 L 896.3 500.8 L 925.0 507.2 L 945.8 515.2 Z',
  'M 1232.9 435.4 L 1245.6 445.0 L 1242.4 446.6 L 1240.8 445.0 L 1274.3 468.9 L 1264.8 460.9 L 1267.9 459.3 L 1274.3 464.1 Z',
  'M 1218.5 416.3 L 1220.1 421.1 L 1234.4 427.4 L 1223.3 419.5 L 1220.1 421.1 Z',
  'M 781.5 417.9 L 778.3 419.5 L 778.3 416.3 L 776.7 421.1 L 773.5 419.5 L 762.4 427.4 Z',
  'M 1173.8 414.7 L 1145.1 408.3 L 1122.8 408.3 L 1106.9 411.5 L 1108.5 413.1 L 1102.1 417.9 L 1092.5 419.5 L 1057.4 437.0 L 1035.1 457.7 L 1044.7 448.2 L 1063.8 435.4 L 1094.1 421.1 L 1134.0 413.1 Z',
  'M 823.0 414.7 L 864.4 413.1 L 905.9 422.6 L 950.6 446.6 L 977.7 472.1 L 950.6 445.0 L 931.4 432.2 L 896.3 416.3 L 880.4 411.5 L 883.6 409.9 L 877.2 411.5 L 874.0 408.3 L 848.5 406.7 L 850.1 408.3 L 843.7 411.5 Z',
];

const LEFT_DARK_PATHS: string[] = [
  'M 508.8 1012.8 L 484.8 1028.7 L 462.5 1051.0 L 449.8 1068.6 L 433.8 1100.5 L 427.4 1121.2 L 424.2 1145.1 L 427.4 1177.0 L 438.6 1208.9 L 456.1 1240.8 L 483.3 1280.7 L 502.4 1323.8 L 507.2 1346.1 L 507.2 1382.8 L 500.8 1405.1 L 508.8 1386.0 L 508.8 1299.8 L 499.2 1266.3 L 459.3 1175.4 L 454.5 1151.5 L 454.5 1119.6 L 459.3 1095.7 L 475.3 1057.4 L 488.0 1038.3 L 508.8 1015.9 Z',
  'M 381.2 952.2 L 379.6 964.9 L 370.0 985.6 L 357.3 998.4 L 346.1 1003.2 L 362.0 1011.2 L 371.6 1022.3 L 379.6 1041.5 L 379.6 1054.2 L 393.9 1027.1 L 403.5 1015.9 L 419.5 1003.2 L 395.5 980.9 Z',
  'M 421.1 770.3 L 401.9 799.0 L 390.7 826.2 L 384.4 859.6 L 387.6 902.7 L 398.7 934.6 L 416.3 964.9 L 438.6 988.8 L 462.5 1003.2 L 438.6 1017.5 L 414.7 1043.1 L 395.5 1078.1 L 386.0 1111.6 L 384.4 1145.1 L 390.7 1178.6 L 405.1 1212.1 L 422.6 1236.0 L 405.1 1205.7 L 395.5 1175.4 L 395.5 1118.0 L 406.7 1082.9 L 429.0 1044.7 L 446.6 1023.9 L 473.7 1003.2 L 459.3 993.6 L 425.8 956.9 L 408.3 926.6 L 395.5 888.4 L 395.5 829.3 L 405.1 799.0 Z',
  'M 500.8 601.3 L 507.2 623.6 L 507.2 658.7 L 502.4 681.0 L 484.8 720.9 L 449.8 773.5 L 435.4 802.2 L 425.8 835.7 L 424.2 862.8 L 425.8 878.8 L 435.4 910.7 L 449.8 937.8 L 460.9 953.7 L 483.3 976.1 L 508.8 993.6 L 508.8 990.4 L 488.0 968.1 L 472.1 942.6 L 460.9 915.5 L 454.5 886.8 L 454.5 854.9 L 460.9 824.6 L 472.1 795.9 L 492.8 754.4 L 508.8 706.5 L 508.8 620.4 Z',
];

const LEFT_GREEN_PATHS: string[] = [
  'M 403.5 1122.8 L 405.1 1127.6 L 401.9 1130.8 L 401.9 1154.7 L 405.1 1162.7 L 405.1 1175.4 L 408.3 1180.2 L 406.7 1181.8 L 409.9 1186.6 L 413.1 1202.6 L 419.5 1212.1 L 417.9 1213.7 L 424.2 1226.5 L 427.4 1228.1 L 441.8 1253.6 L 446.6 1256.8 L 464.1 1282.3 L 481.7 1314.2 L 486.4 1334.9 L 489.6 1339.7 L 488.0 1342.9 L 491.2 1347.7 L 489.6 1384.4 L 494.4 1371.6 L 494.4 1352.5 L 491.2 1342.9 L 492.8 1339.7 L 489.6 1334.9 L 491.2 1331.7 L 472.1 1288.7 L 451.4 1261.6 L 451.4 1258.4 L 446.6 1255.2 L 433.8 1232.9 L 430.6 1231.3 L 417.9 1205.7 L 419.5 1204.1 L 411.5 1186.6 L 411.5 1173.8 L 408.3 1170.7 L 409.9 1164.3 L 405.1 1159.5 Z',
  'M 421.1 1008.0 L 417.9 1008.0 L 416.3 1011.2 L 413.1 1009.6 L 409.9 1015.9 L 403.5 1017.5 L 387.6 1039.9 L 378.0 1062.2 L 379.6 1063.8 L 376.4 1068.6 L 371.6 1090.9 L 374.8 1087.7 L 374.8 1079.7 L 378.0 1076.6 L 376.4 1073.4 L 386.0 1047.8 L 401.9 1023.9 Z',
  'M 494.4 1003.2 L 472.1 1014.4 L 459.3 1027.1 L 457.7 1025.5 L 435.4 1049.4 L 427.4 1063.8 L 421.1 1060.6 L 427.4 1065.4 L 424.2 1067.0 L 424.2 1070.2 L 419.5 1068.6 L 422.6 1071.8 L 419.5 1081.3 L 416.3 1082.9 L 417.9 1084.5 L 413.1 1095.7 L 409.9 1097.3 L 409.9 1105.3 L 406.7 1106.9 L 405.1 1102.1 L 403.5 1110.0 L 405.1 1105.3 L 408.3 1108.5 L 405.1 1113.2 L 406.7 1121.2 L 414.7 1092.5 L 427.4 1068.6 L 430.6 1065.4 L 432.2 1067.0 L 430.6 1063.8 L 433.8 1060.6 L 435.4 1062.2 L 433.8 1057.4 L 459.3 1028.7 L 460.9 1030.3 L 464.1 1027.1 L 464.1 1023.9 Z',
  'M 371.6 910.7 L 379.6 942.6 L 378.0 944.2 L 390.7 971.3 L 397.1 980.9 L 408.3 988.8 L 406.7 990.4 L 409.9 993.6 L 413.1 992.0 L 414.7 995.2 L 417.9 995.2 L 408.3 988.8 L 408.3 985.6 L 405.1 985.6 L 389.2 964.9 L 376.4 933.0 L 378.0 929.8 Z',
  'M 409.9 897.9 L 408.3 902.7 L 411.5 904.3 L 411.5 912.3 L 414.7 915.5 L 413.1 917.1 L 416.3 918.7 L 414.7 920.3 L 424.2 939.4 L 430.6 945.8 L 429.0 947.4 L 433.8 950.6 L 432.2 952.2 L 457.7 980.9 L 459.3 979.3 L 472.1 992.0 L 489.6 1000.0 L 475.3 988.8 L 472.1 988.8 L 467.3 982.5 L 465.7 984.1 L 453.0 971.3 L 454.5 969.7 L 451.4 966.5 L 449.8 968.1 L 443.4 963.3 L 443.4 956.9 L 441.8 958.5 L 438.6 955.3 L 440.2 952.2 L 438.6 953.7 L 433.8 949.0 L 419.5 923.4 Z',
  'M 492.8 625.2 L 489.6 653.9 L 491.2 657.1 L 488.0 661.9 L 481.7 690.6 L 467.3 717.7 L 429.0 770.3 L 413.1 802.2 L 406.7 830.9 L 403.5 835.7 L 405.1 842.1 L 401.9 850.1 L 401.9 870.8 L 405.1 875.6 L 405.1 842.1 L 422.6 787.9 L 440.2 759.2 L 443.4 757.6 L 443.4 754.4 L 470.5 719.3 L 468.9 717.7 L 476.9 708.1 L 475.3 706.5 L 480.1 701.8 L 478.5 700.2 L 488.0 682.6 L 486.4 681.0 L 491.2 671.5 L 489.6 669.9 L 494.4 649.1 L 494.4 636.4 L 491.2 628.4 Z',
];

const LEFT_GRAY_PATHS: string[] = [
  'M 470.5 1020.7 L 438.6 1052.6 L 413.1 1100.5 L 406.7 1124.4 L 408.3 1162.7 L 409.9 1124.4 L 419.5 1089.3 L 440.2 1052.6 L 451.4 1038.3 Z',
  'M 411.5 823.0 L 406.7 843.7 L 406.7 883.6 L 416.3 913.9 L 432.2 944.2 L 445.0 961.7 L 460.9 977.7 L 448.2 964.9 L 432.2 942.6 L 419.5 917.1 L 413.1 897.9 L 408.3 866.0 L 408.3 838.9 Z',
];

const RIGHT_DARK_PATHS: string[] = [
  'M 1499.2 1020.7 L 1500.8 1031.9 L 1515.2 1049.4 L 1531.1 1081.3 L 1540.7 1121.2 L 1540.7 1151.5 L 1535.9 1175.4 L 1523.1 1208.9 L 1499.2 1258.4 L 1499.2 1309.4 L 1513.6 1277.5 L 1543.9 1232.9 L 1558.2 1205.7 L 1569.4 1169.1 L 1571.0 1151.5 L 1566.2 1114.8 L 1550.2 1076.6 L 1532.7 1051.0 L 1508.8 1027.1 Z',
  'M 1615.6 950.6 L 1599.7 980.9 L 1590.1 992.0 L 1574.2 1003.2 L 1585.3 1009.6 L 1601.3 1027.1 L 1614.0 1054.2 L 1615.6 1039.9 L 1623.6 1022.3 L 1633.2 1011.2 L 1649.1 1003.2 L 1638.0 998.4 L 1622.0 980.9 L 1615.6 964.9 Z',
  'M 1574.2 770.3 L 1591.7 802.2 L 1599.7 829.3 L 1602.9 864.4 L 1598.1 896.3 L 1588.5 923.4 L 1569.4 956.9 L 1535.9 993.6 L 1521.5 1003.2 L 1543.9 1019.1 L 1571.0 1051.0 L 1588.5 1082.9 L 1599.7 1118.0 L 1601.3 1165.9 L 1598.1 1183.4 L 1590.1 1205.7 L 1574.2 1234.4 L 1590.1 1212.1 L 1604.5 1178.6 L 1610.8 1143.5 L 1607.7 1105.3 L 1598.1 1075.0 L 1578.9 1041.5 L 1556.6 1017.5 L 1534.3 1003.2 L 1558.2 987.2 L 1583.7 958.5 L 1599.7 928.2 L 1609.3 894.7 L 1610.8 861.2 L 1604.5 826.2 L 1593.3 799.0 Z',
  'M 1499.2 695.4 L 1499.2 744.8 L 1531.1 815.0 L 1540.7 854.9 L 1540.7 885.2 L 1535.9 910.7 L 1521.5 945.8 L 1499.2 977.7 L 1499.2 985.6 L 1508.8 979.3 L 1534.3 953.7 L 1548.6 933.0 L 1563.0 902.7 L 1571.0 862.8 L 1569.4 835.7 L 1558.2 799.0 L 1539.1 764.0 L 1510.4 720.9 Z',
];

const RIGHT_GREEN_PATHS: string[] = [
  'M 1577.4 1081.3 L 1575.8 1082.9 L 1590.1 1122.8 L 1590.1 1159.5 L 1586.9 1175.4 L 1583.7 1175.4 L 1585.3 1181.8 L 1578.9 1194.6 L 1578.9 1201.0 L 1564.6 1231.3 L 1561.4 1232.9 L 1559.8 1239.2 L 1532.7 1274.3 L 1521.5 1295.1 L 1518.3 1296.7 L 1515.2 1307.8 L 1510.4 1314.2 L 1502.4 1341.3 L 1504.0 1344.5 L 1500.8 1357.3 L 1500.8 1370.0 L 1505.6 1382.8 L 1504.0 1386.0 L 1504.0 1350.9 L 1512.0 1319.0 L 1527.9 1287.1 L 1531.1 1285.5 L 1534.3 1277.5 L 1559.8 1244.0 L 1566.2 1231.3 L 1569.4 1229.7 L 1577.4 1208.9 L 1583.7 1199.4 L 1588.5 1183.4 L 1586.9 1181.8 L 1590.1 1178.6 L 1588.5 1175.4 L 1591.7 1170.7 L 1590.1 1167.5 L 1593.3 1153.1 L 1593.3 1135.6 L 1590.1 1126.0 L 1591.7 1121.2 L 1588.5 1116.4 L 1591.7 1113.2 L 1593.3 1114.8 L 1594.9 1110.0 L 1591.7 1110.0 L 1590.1 1113.2 L 1586.9 1110.0 L 1588.5 1108.5 L 1580.5 1090.9 L 1585.3 1087.7 L 1583.7 1086.1 L 1580.5 1089.3 Z',
  'M 1555.0 1049.4 L 1569.4 1068.6 L 1574.2 1065.4 L 1569.4 1067.0 L 1558.2 1051.0 L 1559.8 1049.4 Z',
  'M 1564.6 1001.6 L 1563.0 1003.2 L 1564.6 1001.6 L 1583.7 1014.4 L 1599.7 1031.9 L 1612.4 1054.2 L 1620.4 1082.9 L 1615.6 1059.0 L 1599.7 1027.1 L 1588.5 1015.9 L 1583.7 1014.4 L 1582.1 1009.6 L 1578.9 1011.2 L 1577.4 1008.0 L 1575.8 1009.6 L 1574.2 1006.4 L 1571.0 1006.4 L 1567.8 1000.0 L 1566.2 1003.2 Z',
  'M 1623.6 910.7 L 1618.8 923.4 L 1620.4 926.6 L 1609.3 958.5 L 1598.1 972.9 L 1599.7 974.5 L 1578.9 995.2 L 1575.8 995.2 L 1575.8 998.4 L 1577.4 995.2 L 1585.3 993.6 L 1585.3 990.4 L 1602.9 974.5 L 1615.6 949.0 Z',
  'M 1504.0 622.0 L 1505.6 623.6 L 1502.4 625.2 L 1504.0 628.4 L 1500.8 650.7 L 1507.2 674.6 L 1505.6 676.2 L 1512.0 689.0 L 1510.4 690.6 L 1521.5 709.7 L 1519.9 711.3 L 1523.1 712.9 L 1535.9 735.2 L 1540.7 738.4 L 1548.6 749.6 L 1547.0 751.2 L 1551.8 754.4 L 1567.8 778.3 L 1566.2 779.9 L 1569.4 781.5 L 1578.9 802.2 L 1578.9 810.2 L 1585.3 823.0 L 1583.7 827.8 L 1586.9 829.3 L 1590.1 838.9 L 1590.1 885.2 L 1578.9 917.1 L 1574.2 923.4 L 1572.6 921.9 L 1574.2 925.0 L 1571.0 925.0 L 1572.6 928.2 L 1569.4 928.2 L 1571.0 931.4 L 1567.8 931.4 L 1567.8 937.8 L 1564.6 937.8 L 1566.2 941.0 L 1559.8 949.0 L 1558.2 947.4 L 1559.8 950.6 L 1555.0 955.3 L 1553.4 953.7 L 1555.0 956.9 L 1551.8 960.1 L 1550.2 958.5 L 1550.2 963.3 L 1545.5 968.1 L 1543.9 966.5 L 1540.7 969.7 L 1542.3 971.3 L 1531.1 982.5 L 1529.5 980.9 L 1518.3 992.0 L 1515.2 992.0 L 1502.4 1003.2 L 1500.8 1001.6 L 1504.0 1006.4 L 1510.4 1008.0 L 1523.1 1017.5 L 1531.1 1027.1 L 1532.7 1025.5 L 1540.7 1036.7 L 1537.5 1033.5 L 1539.1 1031.9 L 1548.6 1038.3 L 1523.1 1014.4 L 1502.4 1003.2 L 1523.1 992.0 L 1532.7 982.5 L 1534.3 984.1 L 1548.6 966.5 L 1551.8 966.5 L 1553.4 961.7 L 1555.0 963.3 L 1553.4 961.7 L 1559.8 953.7 L 1563.0 956.9 L 1559.8 960.1 L 1564.6 956.9 L 1559.8 953.7 L 1563.0 949.0 L 1564.6 950.6 L 1563.0 949.0 L 1566.2 944.2 L 1569.4 947.4 L 1566.2 944.2 L 1569.4 942.6 L 1567.8 941.0 L 1577.4 928.2 L 1577.4 921.9 L 1583.7 913.9 L 1582.1 912.3 L 1585.3 910.7 L 1583.7 907.5 L 1585.3 905.9 L 1588.5 909.1 L 1585.3 902.7 L 1588.5 901.1 L 1586.9 894.7 L 1590.1 894.7 L 1588.5 888.4 L 1591.7 885.2 L 1590.1 878.8 L 1593.3 874.0 L 1593.3 845.3 L 1586.9 826.2 L 1586.9 815.0 L 1583.7 813.4 L 1577.4 797.4 L 1580.5 789.5 L 1580.5 792.7 L 1577.4 794.3 L 1577.4 791.1 L 1572.6 786.3 L 1574.2 784.7 L 1564.6 771.9 L 1566.2 770.3 L 1532.7 725.7 L 1513.6 690.6 L 1510.4 681.0 L 1512.0 679.4 L 1508.8 676.2 L 1510.4 674.6 L 1505.6 663.5 L 1507.2 661.9 L 1504.0 650.7 Z',
];

const RIGHT_GRAY_PATHS: string[] = [
  'M 1531.1 1025.5 L 1551.8 1047.8 L 1563.0 1063.8 L 1580.5 1102.1 L 1586.9 1132.4 L 1585.3 1175.4 L 1588.5 1159.5 L 1588.5 1126.0 L 1583.7 1105.3 L 1566.2 1067.0 L 1547.0 1039.9 Z',
  'M 1585.3 829.3 L 1586.9 869.2 L 1577.4 913.9 L 1564.6 941.0 L 1545.5 966.5 L 1531.1 980.9 L 1548.6 963.3 L 1564.6 941.0 L 1583.7 901.1 L 1588.5 883.6 L 1588.5 840.5 Z',
];

type OrnamentPathGroupProps = {
  paths: string[];
  fill: string;
  opacity?: number;
  groupKey: string;
};

function OrnamentPathGroup({ paths, fill, opacity = 1, groupKey }: OrnamentPathGroupProps) {
  return (
    <>
      {paths.map((path, index) => (
        <path key={`${groupKey}-${index}`} d={path} fill={fill} opacity={opacity} />
      ))}
    </>
  );
}

function ReferenceOrnamentShapes({ mainColor, accentColor, shadowColor }: PremiumWaveOrnamentProps) {
  return (
    <g pointerEvents="none">
      <g>
        <OrnamentPathGroup groupKey="top-shadow" paths={TOP_GRAY_PATHS} fill={shadowColor} opacity={0.86} />
        <OrnamentPathGroup groupKey="top-main" paths={TOP_DARK_PATHS} fill={mainColor} opacity={0.98} />
        <OrnamentPathGroup groupKey="top-accent" paths={TOP_GREEN_PATHS} fill={accentColor} opacity={0.92} />
      </g>

      {/* Mirror the top ornament for the bottom so it stays perfectly symmetrical. */}
      <g transform="translate(0 2000) scale(1 -1)">
        <OrnamentPathGroup groupKey="bottom-shadow" paths={TOP_GRAY_PATHS} fill={shadowColor} opacity={0.86} />
        <OrnamentPathGroup groupKey="bottom-main" paths={TOP_DARK_PATHS} fill={mainColor} opacity={0.98} />
        <OrnamentPathGroup groupKey="bottom-accent" paths={TOP_GREEN_PATHS} fill={accentColor} opacity={0.92} />
      </g>

      <g>
        <OrnamentPathGroup groupKey="left-shadow" paths={LEFT_GRAY_PATHS} fill={shadowColor} opacity={0.82} />
        <OrnamentPathGroup groupKey="left-main" paths={LEFT_DARK_PATHS} fill={mainColor} opacity={0.98} />
        <OrnamentPathGroup groupKey="left-accent" paths={LEFT_GREEN_PATHS} fill={accentColor} opacity={0.92} />
      </g>

      <g>
        <OrnamentPathGroup groupKey="right-shadow" paths={RIGHT_GRAY_PATHS} fill={shadowColor} opacity={0.82} />
        <OrnamentPathGroup groupKey="right-main" paths={RIGHT_DARK_PATHS} fill={mainColor} opacity={0.98} />
        <OrnamentPathGroup groupKey="right-accent" paths={RIGHT_GREEN_PATHS} fill={accentColor} opacity={0.92} />
      </g>
    </g>
  );
}

type QrContinuationOrnamentProps = {
  color: string;
  matrixSize: number;
  moduleRadius: number;
  moduleSize: number;
  qrStart: number;
  quietZone: number;
};

function QrContinuationOrnaments({ color, matrixSize, moduleRadius, moduleSize, qrStart, quietZone }: QrContinuationOrnamentProps) {
  const moduleCenter = (row: number, column: number) => ({
    cx: qrStart + (column + quietZone + 0.5) * moduleSize,
    cy: qrStart + (row + quietZone + 0.5) * moduleSize,
  });
  const shouldRender = (row: number, column: number) => {
    const hash = Math.abs((row * 73) ^ (column * 151) ^ ((row + column) * 37));
    return hash % 100 < 49;
  };
  const modules: Array<{ key: string; row: number; column: number }> = [];

  // Fill the full space between the encoded matrix and inner circular boundary.
  // The ornament clip keeps these continuation modules out of the text ring.
  for (let offset = 2; offset <= 10; offset += 1) {
    for (let index = 0; index < matrixSize; index += 1) {
      const topRow = -offset;
      const bottomRow = matrixSize - 1 + offset;
      const leftColumn = -offset;
      const rightColumn = matrixSize - 1 + offset;

      if (shouldRender(topRow, index)) modules.push({ key: `top-${offset}-${index}`, row: topRow, column: index });
      if (shouldRender(bottomRow, index)) modules.push({ key: `bottom-${offset}-${index}`, row: bottomRow, column: index });
      if (shouldRender(index, leftColumn)) modules.push({ key: `left-${offset}-${index}`, row: index, column: leftColumn });
      if (shouldRender(index, rightColumn)) modules.push({ key: `right-${offset}-${index}`, row: index, column: rightColumn });
    }
  }

  // Fill the diagonal pockets between the horizontal and vertical bands.
  // The shared circle clip trims these grid-aligned modules to the badge edge.
  for (let rowOffset = 2; rowOffset <= 10; rowOffset += 1) {
    for (let columnOffset = 2; columnOffset <= 10; columnOffset += 1) {
      const topRow = -rowOffset;
      const bottomRow = matrixSize - 1 + rowOffset;
      const leftColumn = -columnOffset;
      const rightColumn = matrixSize - 1 + columnOffset;
      const cornerCandidates = [
        { key: `top-left-${rowOffset}-${columnOffset}`, row: topRow, column: leftColumn },
        { key: `top-right-${rowOffset}-${columnOffset}`, row: topRow, column: rightColumn },
        { key: `bottom-left-${rowOffset}-${columnOffset}`, row: bottomRow, column: leftColumn },
        { key: `bottom-right-${rowOffset}-${columnOffset}`, row: bottomRow, column: rightColumn },
      ];

      for (const candidate of cornerCandidates) {
        if (shouldRender(candidate.row, candidate.column)) modules.push(candidate);
      }
    }
  }
  return (
    <g pointerEvents="none">
      {modules.map(module => {
        const { cx, cy } = moduleCenter(module.row, module.column);
        return <circle key={module.key} cx={cx} cy={cy} r={moduleRadius} fill={color} />;
      })}
    </g>
  );
}
type PremiumOrnamentLayerProps = PremiumWaveOrnamentProps & {
  style: QROrnamentStyle;
  opacity: number;
  qrColor: string;
  matrixSize: number;
  moduleRadius: number;
  moduleSize: number;
  qrStart: number;
  quietZone: number;
};

function PremiumOrnamentLayer({ style, opacity, mainColor, accentColor, shadowColor, qrColor, matrixSize, moduleRadius, moduleSize, qrStart, quietZone }: PremiumOrnamentLayerProps) {
  if (style === 'none' || opacity <= 0) return null;

  const clampedOpacity = Math.max(0, Math.min(opacity, 1));
  const ornament = style === 'module-mosaic'
    ? <QrContinuationOrnaments color={qrColor} matrixSize={matrixSize} moduleRadius={moduleRadius} moduleSize={moduleSize} qrStart={qrStart} quietZone={quietZone} />
    : <ReferenceOrnamentShapes mainColor={mainColor} accentColor={accentColor} shadowColor={shadowColor} />;

  return (
    <g opacity={clampedOpacity} pointerEvents="none">
      {ornament}
    </g>
  );
}

const CircularPadQR = forwardRef<SVGSVGElement, CircularPadQRProps>(function CircularPadQR(
  {
    value,
    title = 'Adpadz Pad QR',
    topText = 'Adpadz Local Advertising Cooperative',
    bottomText = 'Support Local - Save Local - Discover More',
    centerLabel = 'A',
    shortLabel = 'adpadz.co/q/demo',
    preset = 'circular-pad',
    foregroundColor = '#111111',
    backgroundColor = '#f1f1ef',
    accentColor = '#8EDB39',
    showCenterLabel = true,
    showShortLabel = true,
    logoDataUrl = '',
    centerFrameShape = 'rounded-rect',
    centerFrameStrokeColor = '#111111',
    centerFrameFillColor = '#ffffff',
    rimDecoration = 'none',
    rimBandColor = backgroundColor,
    rimTextColor = foregroundColor,
    innerFieldColor = '#ffffff',
    outerBorderColor = foregroundColor,
    outerBackgroundType = 'none',
    outerBackgroundColor = '#f1f1ef',
    outerBackgroundImageDataUrl = '',
    outerBackgroundImageOpacity = 0.65,
    outerBackgroundImageFit = 'cover',
    outerBackgroundOverlayColor = 'transparent',
    rimBandBackgroundType = 'solid',
    rimBandImageDataUrl = '',
    rimBandImageOpacity = 1,
    rimBandImageFit = 'cover',
    rimBandOverlayColor = '#ffffff',
    rimBandOverlayOpacity = 0.15,
    ornamentStyle = 'wave-premium',
    ornamentMainColor = '#111111',
    ornamentAccentColor = '#8EDB39',
    ornamentShadowColor = '#D8D8D2',
    ornamentOpacity = 1,
    size = VIEWBOX_SIZE,
    className,
  },
  ref,
) {
  const uniqueId = useMemo(() => `pad-qr-${Math.random().toString(36).slice(2)}`, []);
  const qrValue = value.trim() || DEFAULT_VALUE;
  const displayShortLabel = useMemo(() => {
    const cleaned = shortLabel
      .replace(/^https?:\/\//, '')
      .replace(/^localhost:\d+/, 'adpadz.co')
      .replace(/^127\.0\.0\.1:\d+/, 'adpadz.co');

    return cleaned.length > 42 ? `${cleaned.slice(0, 39)}...` : cleaned;
  }, [shortLabel]);

  const matrix = useMemo(() => {
    return QRCode.create(qrValue, {
      errorCorrectionLevel: 'H',
    }) as QRMatrix;
  }, [qrValue]);

  const matrixSize = matrix.modules.size;
  const quietZone = 4;
  const gridSize = matrixSize + quietZone * 2;
  const qrArea = preset === 'standard' ? 1440 : 1080;
  const moduleSize = qrArea / gridSize;
  const qrStart = (VIEWBOX_SIZE - qrArea) / 2;
  const moduleRadius = preset === 'standard' ? 0 : moduleSize * 0.38;
  const isStandard = preset === 'standard';
  const isDigital = preset === 'digital-pad';
  const frameShape = centerFrameShape === 'circle' ? 'circle' : 'rounded-rect';
  const backgroundImageAspect = outerBackgroundImageFit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice';
  const rimBandImageAspect = rimBandImageFit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice';

  function moduleCenter(row: number, column: number) {
    return {
      cx: qrStart + (column + quietZone + 0.5) * moduleSize,
      cy: qrStart + (row + quietZone + 0.5) * moduleSize,
    };
  }

  function finderOrigin(row: number, column: number) {
    return {
      x: qrStart + (column + quietZone) * moduleSize,
      y: qrStart + (row + quietZone) * moduleSize,
    };
  }

  function renderFinder(row: number, column: number) {
    const { x, y } = finderOrigin(row, column);
    const outer = moduleSize * 7;
    const middle = moduleSize * 5;
    const inner = moduleSize * 3;
    const radius = isStandard ? moduleSize * 0.4 : moduleSize * 1.15;

    return (
      <g key={`finder-${row}-${column}`}>
        <rect x={x} y={y} width={outer} height={outer} rx={radius} fill={foregroundColor} />
        <rect
          x={x + moduleSize}
          y={y + moduleSize}
          width={middle}
          height={middle}
          rx={radius * 0.7}
          fill={innerFieldColor}
        />
        <rect
          x={x + moduleSize * 2}
          y={y + moduleSize * 2}
          width={inner}
          height={inner}
          rx={radius * 0.5}
          fill={foregroundColor}
        />
      </g>
    );
  }

  function renderOuterBackground() {
    if (outerBackgroundType === 'none') return null;

    return (
      <g clipPath={`url(#${uniqueId}-backgroundClip)`}>
        {outerBackgroundType === 'solid' && <rect x="60" y="60" width="1880" height="1880" fill={outerBackgroundColor} />}
        {outerBackgroundType === 'gradient' && <rect x="60" y="60" width="1880" height="1880" fill={`url(#${uniqueId}-backgroundGradient)`} />}
        {outerBackgroundType === 'pattern' && <rect x="60" y="60" width="1880" height="1880" fill={`url(#${uniqueId}-backgroundPattern)`} />}
        {outerBackgroundType === 'image' && outerBackgroundImageDataUrl && (
          <image
            href={outerBackgroundImageDataUrl}
            x="60"
            y="60"
            width="1880"
            height="1880"
            opacity={outerBackgroundImageOpacity}
            preserveAspectRatio={backgroundImageAspect}
          />
        )}
        {outerBackgroundOverlayColor !== 'transparent' && (
          <rect x="60" y="60" width="1880" height="1880" fill={outerBackgroundOverlayColor} opacity="0.35" />
        )}
      </g>
    );
  }

  function renderRimBandBackground() {
    if (rimBandBackgroundType === 'solid') return null;

    return (
      <g mask={`url(#${uniqueId}-rimBandMask)`}>
        {rimBandBackgroundType === 'image' && rimBandImageDataUrl && (
          <image
            href={rimBandImageDataUrl}
            x="100"
            y="100"
            width="1800"
            height="1800"
            opacity={rimBandImageOpacity}
            preserveAspectRatio={rimBandImageAspect}
          />
        )}
        {rimBandBackgroundType === 'gradient' && (
          <rect x="100" y="100" width="1800" height="1800" fill={`url(#${uniqueId}-rimBandGradient)`} />
        )}
        {rimBandBackgroundType === 'pattern' && (
          <rect x="100" y="100" width="1800" height="1800" fill={`url(#${uniqueId}-rimBandPattern)`} />
        )}
        {rimBandOverlayColor !== 'transparent' && rimBandOverlayOpacity > 0 && (
          <rect x="100" y="100" width="1800" height="1800" fill={rimBandOverlayColor} opacity={rimBandOverlayOpacity} />
        )}
      </g>
    );
  }

  function renderCenterLogo() {
    if (!showCenterLabel || isStandard) return null;

    if (frameShape === 'circle') {
      return (
        <g>
          <circle cx="1000" cy="1000" r="142" fill={centerFrameFillColor} stroke={centerFrameStrokeColor} strokeWidth="7" />
          {logoDataUrl ? (
            <image href={logoDataUrl} x="890" y="890" width="220" height="220" preserveAspectRatio="xMidYMid meet" />
          ) : (
            <text
              x="1000"
              y="1015"
              fill={centerFrameStrokeColor}
              fontFamily="Poppins, Montserrat, Arial, sans-serif"
              fontWeight="900"
              fontSize="112"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {centerLabel.slice(0, 1).toUpperCase() || 'A'}
            </text>
          )}
        </g>
      );
    }

    return (
      <g>
        <rect
          x="785"
          y="905"
          width="430"
          height="190"
          rx="40"
          fill={centerFrameFillColor}
          stroke={centerFrameStrokeColor}
          strokeWidth="7"
        />
        <rect x="801" y="921" width="398" height="158" rx="29" fill="none" stroke={accentColor} strokeWidth="3" opacity="0.7" />
        {logoDataUrl ? (
          <image href={logoDataUrl} x="825" y="935" width="350" height="130" preserveAspectRatio="xMidYMid meet" />
        ) : (
          <g>
            <text
              x="1000"
              y="994"
              fill={centerFrameStrokeColor}
              fontFamily="Poppins, Montserrat, Arial, sans-serif"
              fontWeight="900"
              fontSize="74"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {centerLabel || 'Adpadz'}
            </text>
            <text
              x="1000"
              y="1051"
              fill={centerFrameStrokeColor}
              fontFamily="Poppins, Montserrat, Arial, sans-serif"
              fontWeight="700"
              fontSize="24"
              textAnchor="middle"
              opacity="0.72"
            >
              Local. Visible. Together.
            </text>
          </g>
        )}
      </g>
    );
  }

  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <defs>
        <filter id={`${uniqueId}-softGlow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="18" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 0.56 0 0 0 0 0.86 0 0 0 0 0.22 0 0 0 0.5 0"
          />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={`${uniqueId}-backgroundGradient`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={outerBackgroundColor} />
          <stop offset="100%" stopColor={accentColor} />
        </linearGradient>
        <pattern id={`${uniqueId}-backgroundPattern`} width="120" height="120" patternUnits="userSpaceOnUse">
          <rect width="120" height="120" fill={outerBackgroundColor} />
          <circle cx="22" cy="22" r="6" fill={accentColor} opacity="0.3" />
          <circle cx="82" cy="78" r="5" fill={outerBorderColor} opacity="0.16" />
        </pattern>
        <linearGradient id={`${uniqueId}-rimBandGradient`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={rimBandColor} />
          <stop offset="100%" stopColor={accentColor} />
        </linearGradient>
        <pattern id={`${uniqueId}-rimBandPattern`} width="120" height="120" patternUnits="userSpaceOnUse">
          <rect width="120" height="120" fill={rimBandColor} />
          <path d="M 0 60 C 30 20 90 100 120 60" fill="none" stroke={accentColor} strokeWidth="3" opacity="0.28" />
          <circle cx="30" cy="30" r="4" fill={outerBorderColor} opacity="0.16" />
          <circle cx="90" cy="90" r="4" fill={outerBorderColor} opacity="0.16" />
        </pattern>
        <mask id={`${uniqueId}-rimBandMask`} maskUnits="userSpaceOnUse">
          <rect x="0" y="0" width="2000" height="2000" fill="black" />
          <circle cx="1000" cy="1000" r="900" fill="white" />
          <circle cx="1000" cy="1000" r="700" fill="black" />
        </mask>
        <clipPath id={`${uniqueId}-backgroundClip`}>
          <rect x="60" y="60" width="1880" height="1880" rx="170" />
        </clipPath>
        <clipPath id={`${uniqueId}-ornamentClip`}>
          <circle cx="1000" cy="1000" r="690" />
        </clipPath>
        <path id={`${uniqueId}-topArc`} d="M 205 1000 A 795 795 0 0 1 1795 1000" />
        <path id={`${uniqueId}-bottomArc`} d="M 205 1000 A 795 795 0 0 0 1795 1000" />
      </defs>

      {renderOuterBackground()}

      {!isStandard && (
        <g>
          <circle cx="1000" cy="1000" r="900" fill={rimBandColor} />
          {renderRimBandBackground()}
          <circle cx="1000" cy="1000" r="900" fill="none" stroke={outerBorderColor} strokeWidth="14" />
          <circle
            cx="1000"
            cy="1000"
            r="862"
            fill="none"
            stroke={isDigital ? accentColor : outerBorderColor}
            strokeWidth={isDigital ? 7 : 4}
            opacity="0.98"
            filter={isDigital ? `url(#${uniqueId}-softGlow)` : undefined}
          />
          <circle cx="1000" cy="1000" r="700" fill="none" stroke={outerBorderColor} strokeWidth="10" opacity="0.95" />
          <circle cx="1000" cy="1000" r="670" fill={innerFieldColor} opacity="1" />

          {rimDecoration === 'none' && null}

          <g clipPath={`url(#${uniqueId}-ornamentClip)`}>
            <PremiumOrnamentLayer
              style={ornamentStyle}
              mainColor={ornamentMainColor}
              accentColor={ornamentAccentColor}
              shadowColor={ornamentShadowColor}
              opacity={ornamentOpacity}
              qrColor={foregroundColor}
              matrixSize={matrixSize}
              moduleRadius={moduleRadius}
              moduleSize={moduleSize}
              qrStart={qrStart}
              quietZone={quietZone}
            />
          </g>

          <text
            fill={rimTextColor}
            fontFamily="Poppins, Montserrat, Arial, sans-serif"
            fontWeight="800"
            fontSize="56"
            letterSpacing="0"
            dominantBaseline="middle"
          >
            <textPath href={`#${uniqueId}-topArc`} startOffset="50%" textAnchor="middle">
              {topText}
            </textPath>
          </text>
          <text
            fill={rimTextColor}
            fontFamily="Poppins, Montserrat, Arial, sans-serif"
            fontWeight="800"
            fontSize="49"
            letterSpacing="0"
            dominantBaseline="middle"
          >
            <textPath href={`#${uniqueId}-bottomArc`} startOffset="50%" textAnchor="middle">
              {bottomText}
            </textPath>
          </text>
        </g>
      )}

      {isStandard && (
        <rect
          x={qrStart - 48}
          y={qrStart - 48}
          width={qrArea + 96}
          height={qrArea + 96}
          rx="56"
          fill={innerFieldColor}
        />
      )}

      <g>
        {Array.from({ length: matrixSize }).map((_, row) =>
          Array.from({ length: matrixSize }).map((__, column) => {
            const index = row * matrixSize + column;
            const isDark = Boolean(matrix.modules.data[index]);

            if (!isDark || isFinderModule(row, column, matrixSize)) {
              return null;
            }

            const { cx, cy } = moduleCenter(row, column);

            if (isStandard) {
              return (
                <rect
                  key={`${row}-${column}`}
                  x={cx - moduleSize / 2}
                  y={cy - moduleSize / 2}
                  width={moduleSize}
                  height={moduleSize}
                  fill={foregroundColor}
                />
              );
            }

            return <circle key={`${row}-${column}`} cx={cx} cy={cy} r={moduleRadius} fill={foregroundColor} />;
          }),
        )}

        {renderFinder(0, 0)}
        {renderFinder(0, matrixSize - 7)}
        {renderFinder(matrixSize - 7, 0)}
      </g>

      {!isStandard && showShortLabel && (
        <g>
          <rect x="650" y="1545" width="700" height="95" rx="47.5" fill={centerFrameFillColor} stroke={outerBorderColor} strokeWidth="4" opacity="0.97" />
          <text
            x="1000"
            y="1593"
            fill={foregroundColor}
            fontFamily="Poppins, Montserrat, Arial, sans-serif"
            fontWeight="800"
            fontSize="32"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {displayShortLabel}
          </text>
        </g>
      )}

      {renderCenterLogo()}
    </svg>
  );
});

export default CircularPadQR;
