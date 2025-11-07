import color from "color";
// Opacities without color values ///////////////////////////////////////////////
// Disabled elements should be 0.5 opacity
// Hover can be 0.8 opacity if complex component

export const HOVER_OPACITY = 0.7;

// Brand Colors
export const baseWhite = "#ffffff";
export const brandBackpackLogoRed = "#e33e3f";
export const brandPixelBlurple = "#6360ff";
export const brandPixelLavender = "#c061f7";
export const brandPixelOcean = "#28dbd1";
export const brandPixelCoral = "#fe6f5c";
export const brandPixelLemon = "#feed5c";

// Purple - Phantom-inspired accent colors
export const lightAccentPurple = "#4E44CE"; // Phantom Purple Heart
export const darkAccentPurple = "#8B7FFF"; // Lighter variant for dark mode

// Blue - Phantom-inspired purple-blue gradient
export const blue50 = "rgb(240, 240, 255)";
export const blue100 = "rgb(224, 224, 255)";
export const blue200 = "rgb(199, 199, 255)";
export const blue300 = "rgb(165, 165, 255)";
export const blue400 = "rgb(139, 127, 255)"; // Purple-blue blend
export const blue500 = "rgb(107, 93, 255)"; // Lighter Phantom purple
export const blue600 = "rgb(78, 68, 206)"; // Phantom Purple Heart
export const blue700 = "rgb(62, 55, 175)"; // Darker Phantom purple
export const blue800 = "rgb(49, 44, 140)";
export const blue900 = "rgb(36, 32, 105)";
export const blue950 = "rgb(23, 20, 70)";

// Neutral Colors - Updated for better dark mode contrast (Hyperliquid-inspired)
export const base50 = "rgba(244, 244, 246, 1)"; // formerly #f8f8f9
export const base100 = "rgba(238, 239, 241, 1)"; // formerly #f0f0f2
export const base200 = "rgba(227, 228, 232, 1)"; // formerly #dfe0e5
export const base300 = "rgba(200, 201, 208, 1)"; // formerly #c2c4cc
export const base400 = "rgba(150, 159, 175, 1)"; // formerly #8f929e
export const base500 = "rgba(117, 121, 138, 1)"; // formerly #787c89
export const base600 = "rgba(93, 96, 111, 1)"; // formerly #555c6b
export const base700 = "rgba(56, 58, 69, 1)"; // formerly #4e5768
export const base800 = "rgba(36, 36, 36, 1)"; // Updated to #242424 for better contrast
export const base900 = "rgba(27, 27, 27, 1)"; // Updated to #1b1b1b for subtle layering
export const base950 = "rgba(18, 18, 18, 1)"; // Updated to #121212 for deepest background

// Success Colors
export const green50 = "rgba(239, 251, 245, 1)";
export const green100 = "rgba(224, 248, 239, 1)"; // formerly #f1ffef
export const green200 = "rgba(184, 238, 217, 1)";
export const green300 = "rgba(124, 229, 181, 1)";
export const green400 = "rgba(30, 224, 150, 1)";
export const green500 = "rgba(0, 194, 120, 1)"; //formerly #42c337
export const green600 = "rgba(0, 158, 99, 1)"; // formerly #11a800
export const green700 = "rgba(0, 121, 75, 1)"; // formerly #138600
export const green800 = "rgba(0, 94, 66, 1)";
export const green900 = "rgba(0, 58, 36, 1)";
export const green950 = "rgba(18, 35, 34, 1)";

// Warning Colors
export const yellow50 = "rgba(255, 253, 234)";
export const yellow100 = "rgba(255, 249, 223, 1)"; // formerly #fff9df
export const yellow200 = "rgba(255, 239, 189, 1)";
export const yellow300 = "rgba(255, 223, 129, 1)";
export const yellow400 = "rgba(248, 200, 64, 1)";
export const yellow500 = "rgba(239, 164, 17, 1)"; // formerly #efa411
export const yellow600 = "rgba(206, 121, 7, 1)"; // formerly #ce7907
export const yellow700 = "rgba(177, 87, 0, 1)"; // formerly #b15700
export const yellow800 = "rgba(140, 80, 10, 1)";
export const yellow900 = "rgba(72, 47, 16, 1)";
export const yellow950 = "rgba(38, 32, 26, 1)";

// Error Colors
export const red50 = "rgba(255, 244, 243, 1)";
export const red100 = "rgba(255, 237, 235, 1)"; // previously #ffedeb
export const red200 = "rgba(255, 220, 217, 1)";
export const red300 = "rgba(255, 200, 199, 1)";
export const red400 = "rgba(255, 160, 161, 1)";
export const red500 = "rgba(255, 87, 90, 1)"; // previously #FF6269
export const red600 = "rgba(234, 56, 59, 1)"; // previously #f13236
export const red700 = "rgba(210, 0, 36, 1)"; // previously #d20024
export const red800 = "rgba(157, 0, 24, 1)";
export const red900 = "rgba(96, 0, 0, 1)";
export const red950 = "rgba(53, 26, 31, 1)";

// Light Mode /////////////////////////////////////////////////////

// export const lightNeutralBackgroundAppBackground = "linear-gradient(to bottom, #f8f8f9 0%,#f0f0f2 100%)";

// Light Mode Backgrounds
export const lightBaseBackgroundL0 = base50; // app background
export const lightBaseBackgroundL1 = baseWhite; // card background
export const lightBaseBackgroundL2 = base100;

// Light Mode Text
export const lightBaseTextHighEmphasis = base900;
export const lightBaseTextMedEmphasis = base600;

// Light Mode Icons
export const lightBaseIcon = base500; // this meets 3:1 color contrast on white for WCAG AA
export const lightBaseIconHover = base500; // increase contrast on hover
export const lightBaseIconPress = base500; // decrease contrast on press

// Light Mode Borders
export const lightBaseDivider = base100; // used for separators between list items or tables
export const lightBaseBorderLight = base100; // default border color outside of cards
export const lightBaseBorderMed = base200; // darker border color if needed
export const lightBaseBorderFocus = base700; // input focus border color

// Light Mode Buttons
export const lightButtonPrimaryBackground = base900;
export const lightButtonPrimaryText = base50;
export const lightButtonSecondaryBackground = baseWhite;
export const lightButtonSecondaryText = base900;
export const lightRedPrimaryButtonBackground = red700;
export const lightRedPrimaryButtonTextColor = base50;
export const lightRedSecondaryButtonBackground = color(red500)
  .alpha(12)
  .string();
export const lightRedSecondaryButtonTextColor = red700;
export const lightGreenPrimaryButtonBackground = green700;
export const lightGreenPrimaryButtonTextColor = base50;
export const lightGreenSecondaryButtonBackground = color(green500)
  .alpha(12)
  .string();
export const lightGreenSecondaryButtonTextColor = green700;
export const lightBluePrimaryButtonBackground = blue700;
export const lightBluePrimaryButtonTextColor = base50;
export const lightBlueSecondaryButtonBackground = color(blue700)
  .alpha(16)
  .string();
export const lightBlueSecondaryButtonTextColor = blue700;

// Light Mode Blue
export const lightAccentBlue = blue700; // used for text and icons
export const lightAccentBlueBackground = color(blue700).alpha(0.15).string();

// Light Mode Success
export const lightGreenText = green700;
export const lightGreenIcon = green600;
export const lightGreenBorder = color(green600).alpha(0.4).string();
export const lightGreenBackgroundSolid = green100;
export const lightGreenBackgroundTransparent = color(green500)
  .alpha(0.12)
  .string();

// Light Mode Warning
export const lightYellowText = yellow700;
export const lightYellowIcon = yellow600;
export const lightYellowBorder = color(yellow700).alpha(0.5).string();
export const lightYellowBackgroundSolid = yellow100;
export const lightYellowBackgroundTransparent = color(yellow500)
  .alpha(0.12)
  .string();

// Light Mode Error
export const lightRedText = red700;
export const lightRedIcon = red600;
export const lightRedBorder = color(red700).alpha(0.5).string();
export const lightRedBackgroundSolid = red100;
export const lightRedBackgroundTransparent = color(red700).alpha(0.12).string();

// Dark Mode //////////////////////////////////////////////////////

// Dark Mode Backgrounds
export const darkBaseBackgroundL0 = base950; // dark container background
export const darkBaseBackgroundL1 = base800; // dark content background
export const darkBaseBackgroundL2 = base900;

// Dark Mode Text - Using 87% white opacity for high emphasis (Material Design standard)
export const darkBaseTextHighEmphasis = "rgba(255, 255, 255, 0.87)";
export const darkBaseTextMedEmphasis = "rgba(255, 255, 255, 0.60)";

// Dark Mode Icons
export const darkBaseIcon = base500; // meets 3:1 color contrast on base800 for WCAG AA
export const darkBaseIconHover = base400; // increase contrast on hover
export const darkBaseIconPress = base500; // decrease contrast on press
export const darkBaseIconHighContrast = base400; // icon hover if not using opacity

// Dark Mode Borders

export const darkBaseDivider = color(baseWhite).alpha(0.1).string(); // used for separators between list items or tables
export const darkBaseBorderLight = base800; // default border color outside of cards
export const darkBaseBorderMed = color(baseWhite).alpha(0.15).string();
export const darkBaseBorderFocus = base300; // input focus border color

// Dark Mode Buttons
export const darkButtonPrimaryBackground = baseWhite;
export const darkButtonPrimaryText = base900;
export const darkButtonSecondaryBackground = base800;
export const darkButtonSecondaryText = base50;
export const darkRedPrimaryButtonBackground = red500;
export const darkRedPrimaryButtonTextColor = base900;
export const darkRedSecondaryButtonBackground = color(red500)
  .alpha(12)
  .string();
export const darkRedSecondaryButtonTextColor = red500;
export const darkGreenPrimaryButtonBackground = green500;
export const darkGreenPrimaryButtonTextColor = base900;
export const darkGreenSecondaryButtonBackground = color(green500)
  .alpha(12)
  .string();
export const darkGreenSecondaryButtonTextColor = green500;
export const darkBluePrimaryButtonBackground = blue500;
export const darkBluePrimaryButtonTextColor = base900;
export const darkBlueSecondaryButtonBackground = color(blue700)
  .alpha(16)
  .string();
export const darkBlueSecondaryButtonTextColor = blue500;

// Dark Mode Blue
export const darkAccentBlue = blue500; // used for text and icons
export const darkAccentBlueBackground = color(blue700).alpha(0.2).string();

// Dark Mode Success
export const darkGreenText = green500;
export const darkGreenIcon = green500;
export const darkGreenBorder = color(green500).alpha(0.4).string(); // green500 at 40%
export const darkGreenBackgroundTransparent = color(green500)
  .alpha(0.08)
  .string(); // green500 at 8%
export const darkGreenBackgroundSolid = "rgba(18, 35, 34, 1)"; // derived from putting green500 at 8% opacity on base900

// Dark Mode Warning
export const darkYellowText = yellow500;
export const darkYellowIcon = yellow500;
export const darkYellowBorder = color(yellow500).alpha(0.5).string();
export const darkYellowBackgroundTransparent = color(yellow500)
  .alpha(0.08)
  .string();
export const darkYellowBackgroundSolid = "rgba(38, 32, 26, 1)"; // derived from putting yellow500 at 8% opacity on base900

// Dark Mode Error
export const darkRedText = red500;
export const darkRedIcon = red500;
export const darkRedBorder = color(red600).alpha(0.5).string();
export const darkRedBackgroundTransparent = color(red600).alpha(0.12).string();
export const darkRedBackgroundSolid = "rgba(53, 26, 31, 1)"; // derived from putting red600 at 12% opacity on base900

// Misc Color Definitions ////////////////////////////////////////
export const lightOverlayBackground = color(base900).alpha(0.4).string();
export const darkOverlayBackground = color(base800).alpha(0.4).string();
export const lightSelectionTextColor = base900; // color of selected text in light mode
export const lightSelectionBackgroundColor = brandPixelLemon; // background of selected text
export const darkSelectionTextColor = base900; // color of selected text in dark mode
export const darkSelectionBackgroundColor = brandPixelLemon; // background of selected text in dark mode

const lightUsernameColors = {
  lightUser01: "#E02929",
  lightUser02: "#CC2578",
  lightUser03: "#9930B8",
  lightUser04: "#5E35B1",
  lightUser05: "#3949AB",
  lightUser06: "#0072DB",
  lightUser07: "#0C5ADF",
  lightUser08: "#008577",
  lightUser09: "#1A841F",
  lightUser10: "#6C7D26",
  lightUser11: "#BD5B00",
  lightUser12: "#CC4218",
  lightUser13: "#6D4C41",
  lightUser14: "#2D4363",
};

const darkUsernameColors = {
  darkUser01: "#F88484",
  darkUser02: "#E57AB0",
  darkUser03: "#DA8BE7",
  darkUser04: "#C2A6F4",
  darkUser05: "#97A4F4",
  darkUser06: "#57AEFF",
  darkUser07: "#5596F6",
  darkUser08: "#7ACCC7",
  darkUser09: "#75DD7A",
  darkUser10: "#BEE05A",
  darkUser11: "#FFD080",
  darkUser12: "#FA9476",
  darkUser13: "#BCAAA4",
  darkUser14: "#A3B5CF",
};

export const lightColors = {
  baseWhite,
  ...lightUsernameColors,
  lightAccentBlue,
  lightAccentBlueBackground,
  lightAccentPurple,
  lightBaseBackgroundL0,
  lightBaseBackgroundL1,
  lightBaseBackgroundL2,
  lightBaseBorderLight,
  lightBaseBorderMed,
  lightBaseBorderFocus,
  lightBaseDivider,
  lightBaseIcon,
  lightBaseIconHover,
  lightBaseIconPress,
  lightBaseTextHighEmphasis,
  lightBaseTextMedEmphasis,
  lightButtonPrimaryBackground,
  lightButtonPrimaryText,
  lightButtonSecondaryBackground,
  lightButtonSecondaryText,
  lightRedPrimaryButtonBackground,
  lightRedPrimaryButtonTextColor,
  lightRedSecondaryButtonBackground,
  lightGreenPrimaryButtonBackground,
  lightGreenPrimaryButtonTextColor,
  lightGreenSecondaryButtonBackground,
  lightGreenSecondaryButtonTextColor,
  lightBluePrimaryButtonBackground,
  lightBluePrimaryButtonTextColor,
  lightBlueSecondaryButtonBackground,
  lightGreenBackgroundSolid,
  lightGreenBackgroundTransparent,
  lightGreenBorder,
  lightGreenIcon,
  lightGreenText,
  lightOverlayBackground,
  lightRedBackgroundSolid,
  lightRedBackgroundTransparent,
  lightRedBorder,
  lightRedIcon,
  lightRedText,
  lightSelectionBackgroundColor,
  lightSelectionTextColor,
  lightYellowBackgroundSolid,
  lightYellowBackgroundTransparent,
  lightYellowBorder,
  lightYellowIcon,
  lightYellowText,
};

export const darkColors = {
  baseWhite,
  ...darkUsernameColors,
  darkAccentBlue,
  darkAccentBlueBackground,
  darkAccentPurple,
  darkBaseBackgroundL0,
  darkBaseBackgroundL1,
  darkBaseBackgroundL2,
  darkBaseBorderLight,
  darkBaseBorderMed,
  darkBaseBorderFocus,
  darkBaseDivider,
  darkBaseIcon,
  darkBaseIconHighContrast,
  darkBaseIconHover,
  darkBaseIconPress,
  darkBaseTextHighEmphasis,
  darkBaseTextMedEmphasis,
  darkButtonPrimaryBackground,
  darkButtonPrimaryText,
  darkButtonSecondaryBackground,
  darkButtonSecondaryText,
  darkRedPrimaryButtonBackground,
  darkRedPrimaryButtonTextColor,
  darkRedSecondaryButtonBackground,
  darkGreenPrimaryButtonBackground,
  darkGreenPrimaryButtonTextColor,
  darkGreenSecondaryButtonBackground,
  darkGreenSecondaryButtonTextColor,
  darkBluePrimaryButtonBackground,
  darkBluePrimaryButtonTextColor,
  darkBlueSecondaryButtonBackground,
  darkGreenBackgroundTransparent,
  darkGreenBackgroundSolid,
  darkGreenBorder,
  darkGreenIcon,
  darkGreenText,
  darkOverlayBackground,
  darkRedBackgroundSolid,
  darkRedBackgroundTransparent,
  darkRedBorder,
  darkRedIcon,
  darkRedText,
  darkSelectionBackgroundColor,
  darkSelectionTextColor,
  darkYellowBackgroundSolid,
  darkYellowBackgroundTransparent,
  darkYellowBorder,
  darkYellowIcon,
  darkYellowText,
};
