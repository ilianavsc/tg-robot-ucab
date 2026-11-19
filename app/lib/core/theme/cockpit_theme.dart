import 'package:flutter/material.dart';

/// Tokens de color del sistema de diseño **Autonomous Laboratory Cockpit**
/// (`DESIGN.md`, generado en Google Stitch).
///
/// Los valores salen del front-matter del DESIGN.md (tokens Material 3), que
/// son los que usan las capturas de las 4 pantallas: fondo `#10141A`, tarjetas
/// `#181C22`, celdas `#1C2026`, E-STOP y CRITICAL `#93000A`, acento `#00F2FE`.
/// La amarilla de advertencia (`#F59E0B`) y el rojo de peligro (`#EF4444`)
/// vienen de la sección "Colors" del mismo documento.
abstract final class CockpitColors {
  // Superficies (de la más hundida a la más elevada)
  static const Color surfaceLowest = Color(
    0xFF0A0E14,
  ); // barra de app y de navegación
  static const Color surface = Color(0xFF10141A); // lienzo base
  static const Color surfaceLow = Color(0xFF181C22); // tarjetas
  static const Color surfaceContainer = Color(0xFF1C2026); // celdas de métrica
  static const Color surfaceHigh = Color(
    0xFF262A31,
  ); // botones secundarios, pozos
  static const Color surfaceHighest = Color(0xFF31353C); // modales

  // Texto y contornos
  static const Color onSurface = Color(0xFFDFE2EB);
  static const Color onSurfaceVariant = Color(0xFFB9CACB);
  static const Color outline = Color(0xFF849495);
  static const Color outlineVariant = Color(0xFF3A494B);

  // Primario: "Cyber Teal". `primary` es el token primary-container (#00F2FE),
  // el acento real de las capturas; `primaryText` es el token primary (#E0FDFF).
  static const Color primary = Color(0xFF00F2FE);
  static const Color primaryText = Color(0xFFE0FDFF);
  static const Color onPrimary = Color(0xFF00373A);
  static const Color primaryDim = Color(0xFF00DCE6);
  static const Color primaryTonal = Color(0xFF004F53);
  static const Color onPrimaryContainer = Color(0xFF006A70);

  // Secundario: "Electric Cobalt"
  static const Color secondary = Color(0xFFADC6FF);
  static const Color secondaryContainer = Color(0xFF0566D9);

  // Terciario: "Autonomous Emerald" (salud del sistema, trayectoria nominal)
  static const Color ok = Color(0xFF4EDEA3);
  static const Color okContainer = Color(0xFF67F4B7);
  static const Color okTonal = Color(0xFF005236);

  // Alertas
  static const Color error = Color(
    0xFFFFB4AB,
  ); // texto/contorno sobre fondo oscuro
  static const Color errorContainer = Color(
    0xFF93000A,
  ); // E-STOP, etiquetas CRITICAL
  static const Color onErrorContainer = Color(0xFFFFDAD6);
  static const Color hazard = Color(
    0xFFEF4444,
  ); // relleno y resplandor de peligro
  static const Color warning = Color(
    0xFFF59E0B,
  ); // precaución (20-50 cm, batería)
}

/// Estilos tipográficos del DESIGN.md: **Inter** para títulos y descripciones,
/// **JetBrains Mono** para toda la telemetría (cifras en columnas fijas).
abstract final class CockpitText {
  static const String sans = 'Inter';
  static const String mono = 'JetBrainsMono';

  static const List<FontFeature> tabular = <FontFeature>[
    FontFeature.tabularFigures(),
  ];

  static const TextStyle displayLg = TextStyle(
    fontFamily: sans,
    fontSize: 40,
    height: 48 / 40,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.8,
  );
  static const TextStyle headlineLg = TextStyle(
    fontFamily: sans,
    fontSize: 32,
    height: 40 / 32,
    fontWeight: FontWeight.w600,
  );
  static const TextStyle headlineLgMobile = TextStyle(
    fontFamily: sans,
    fontSize: 26,
    height: 34 / 26,
    fontWeight: FontWeight.w600,
  );
  static const TextStyle headlineMd = TextStyle(
    fontFamily: sans,
    fontSize: 24,
    height: 32 / 24,
    fontWeight: FontWeight.w600,
  );
  static const TextStyle headlineSm = TextStyle(
    fontFamily: sans,
    fontSize: 20,
    height: 28 / 20,
    fontWeight: FontWeight.w600,
  );
  static const TextStyle titleMd = TextStyle(
    fontFamily: sans,
    fontSize: 16,
    height: 24 / 16,
    fontWeight: FontWeight.w600,
  );
  static const TextStyle bodyLg = TextStyle(
    fontFamily: sans,
    fontSize: 16,
    height: 24 / 16,
    fontWeight: FontWeight.w400,
  );
  static const TextStyle bodyMd = TextStyle(
    fontFamily: sans,
    fontSize: 14,
    height: 20 / 14,
    fontWeight: FontWeight.w400,
  );
  static const TextStyle bodySm = TextStyle(
    fontFamily: sans,
    fontSize: 12,
    height: 16 / 12,
    fontWeight: FontWeight.w400,
  );

  /// Lectura grande (22 px, 700).
  static const TextStyle telemetryLg = TextStyle(
    fontFamily: mono,
    fontSize: 22,
    height: 28 / 22,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.22,
  );

  /// Lectura media (14 px, 500).
  static const TextStyle telemetryMd = TextStyle(
    fontFamily: mono,
    fontSize: 14,
    height: 18 / 14,
    fontWeight: FontWeight.w500,
  );

  /// Etiqueta de grupo diagnóstico (11 px, 400, mayúsculas).
  static const TextStyle telemetrySm = TextStyle(
    fontFamily: mono,
    fontSize: 11,
    height: 14 / 11,
    fontWeight: FontWeight.w400,
    letterSpacing: 0.44,
  );

  /// Etiqueta de estado o de control (12 px, 600, mayúsculas).
  static const TextStyle labelMd = TextStyle(
    fontFamily: mono,
    fontSize: 12,
    height: 16 / 12,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.6,
  );
}

/// Radios del DESIGN.md: 4 px base, 8 px grupos de control, 12 px botones y
/// tarjetas principales, cápsula completa para pastillas de estado.
abstract final class CockpitRadius {
  static const double sm = 4;
  static const double md = 8;
  static const double lg = 12;
  static const double xl = 16;
}

/// Tema oscuro Material 3 del Cockpit. Se usa como `theme` y `darkTheme`.
ThemeData buildCockpitTheme() {
  const ColorScheme esquema = ColorScheme(
    brightness: Brightness.dark,
    primary: CockpitColors.primary,
    onPrimary: CockpitColors.onPrimary,
    primaryContainer: CockpitColors.primaryTonal,
    onPrimaryContainer: Color(0xFF6FF6FF),
    secondary: CockpitColors.secondary,
    onSecondary: Color(0xFF002E6A),
    secondaryContainer: CockpitColors.secondaryContainer,
    onSecondaryContainer: Color(0xFFE6ECFF),
    tertiary: CockpitColors.ok,
    onTertiary: Color(0xFF003824),
    tertiaryContainer: CockpitColors.okTonal,
    onTertiaryContainer: Color(0xFF6FFBBE),
    error: CockpitColors.error,
    onError: Color(0xFF690005),
    errorContainer: CockpitColors.errorContainer,
    onErrorContainer: CockpitColors.onErrorContainer,
    surface: CockpitColors.surface,
    onSurface: CockpitColors.onSurface,
    surfaceDim: CockpitColors.surface,
    surfaceBright: Color(0xFF353940),
    surfaceContainerLowest: CockpitColors.surfaceLowest,
    surfaceContainerLow: CockpitColors.surfaceLow,
    surfaceContainer: CockpitColors.surfaceContainer,
    surfaceContainerHigh: CockpitColors.surfaceHigh,
    surfaceContainerHighest: CockpitColors.surfaceHighest,
    onSurfaceVariant: CockpitColors.onSurfaceVariant,
    outline: CockpitColors.outline,
    outlineVariant: CockpitColors.outlineVariant,
    shadow: Color(0xFF000000),
    scrim: Color(0xFF000000),
    inverseSurface: CockpitColors.onSurface,
    onInverseSurface: Color(0xFF2D3137),
    inversePrimary: Color(0xFF00696F),
    surfaceTint: CockpitColors.primaryDim,
  );

  final TextTheme textos =
      const TextTheme(
        displayLarge: CockpitText.displayLg,
        headlineLarge: CockpitText.headlineLg,
        headlineMedium: CockpitText.headlineMd,
        headlineSmall: CockpitText.headlineSm,
        titleLarge: CockpitText.headlineSm,
        titleMedium: CockpitText.titleMd,
        titleSmall: CockpitText.titleMd,
        bodyLarge: CockpitText.bodyLg,
        bodyMedium: CockpitText.bodyMd,
        bodySmall: CockpitText.bodySm,
        labelLarge: CockpitText.labelMd,
        labelMedium: CockpitText.labelMd,
        labelSmall: CockpitText.telemetrySm,
      ).apply(
        bodyColor: CockpitColors.onSurface,
        displayColor: CockpitColors.onSurface,
      );

  final RoundedRectangleBorder formaControl = RoundedRectangleBorder(
    borderRadius: BorderRadius.circular(CockpitRadius.md),
  );

  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: esquema,
    fontFamily: CockpitText.sans,
    textTheme: textos,
    scaffoldBackgroundColor: CockpitColors.surface,
    canvasColor: CockpitColors.surface,
    dividerTheme: const DividerThemeData(
      color: CockpitColors.outlineVariant,
      thickness: 1,
      space: 1,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: CockpitColors.surfaceLowest,
      surfaceTintColor: Colors.transparent,
      foregroundColor: CockpitColors.onSurface,
      elevation: 0,
      scrolledUnderElevation: 0,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: CockpitColors.surfaceLowest,
      surfaceTintColor: Colors.transparent,
      indicatorColor: CockpitColors.primary.withValues(alpha: 0.16),
      indicatorShape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(CockpitRadius.xl),
      ),
      height: 72,
      elevation: 0,
      labelTextStyle: WidgetStateProperty.resolveWith<TextStyle>(
        (Set<WidgetState> estados) => CockpitText.telemetrySm.copyWith(
          fontWeight: FontWeight.w600,
          color: estados.contains(WidgetState.selected)
              ? CockpitColors.primary
              : CockpitColors.onSurfaceVariant,
        ),
      ),
      iconTheme: WidgetStateProperty.resolveWith<IconThemeData>(
        (Set<WidgetState> estados) => IconThemeData(
          size: 24,
          color: estados.contains(WidgetState.selected)
              ? CockpitColors.primary
              : CockpitColors.onSurfaceVariant,
        ),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: CockpitColors.primary,
        foregroundColor: CockpitColors.onPrimary,
        disabledBackgroundColor: CockpitColors.surfaceHigh,
        disabledForegroundColor: CockpitColors.outline,
        minimumSize: const Size(0, 48),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        shape: formaControl,
        textStyle: CockpitText.labelMd.copyWith(fontSize: 13),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        backgroundColor: CockpitColors.surfaceHigh,
        foregroundColor: CockpitColors.onSurface,
        disabledForegroundColor: CockpitColors.outline,
        minimumSize: const Size(0, 48),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        side: const BorderSide(color: CockpitColors.outlineVariant),
        shape: formaControl,
        textStyle: CockpitText.labelMd.copyWith(fontSize: 13),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: CockpitColors.primary,
        minimumSize: const Size(0, 40),
        shape: formaControl,
        textStyle: CockpitText.labelMd,
      ),
    ),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: SegmentedButton.styleFrom(
        backgroundColor: CockpitColors.surfaceContainer,
        foregroundColor: CockpitColors.onSurfaceVariant,
        selectedBackgroundColor: CockpitColors.primary,
        selectedForegroundColor: CockpitColors.onPrimary,
        disabledBackgroundColor: CockpitColors.surfaceContainer,
        disabledForegroundColor: CockpitColors.outline,
        side: const BorderSide(color: CockpitColors.outlineVariant),
        textStyle: CockpitText.labelMd,
        visualDensity: VisualDensity.compact,
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: CockpitColors.surfaceHighest,
      contentTextStyle: CockpitText.bodyMd.copyWith(
        color: CockpitColors.onSurface,
      ),
      shape: formaControl,
    ),
    tooltipTheme: TooltipThemeData(
      decoration: BoxDecoration(
        color: CockpitColors.surfaceHighest,
        borderRadius: BorderRadius.circular(CockpitRadius.sm),
        border: Border.all(color: CockpitColors.outlineVariant),
      ),
      textStyle: CockpitText.telemetrySm.copyWith(
        color: CockpitColors.onSurface,
      ),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: CockpitColors.surfaceHighest,
      surfaceTintColor: Colors.transparent,
      showDragHandle: true,
      dragHandleColor: CockpitColors.outline,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(CockpitRadius.lg),
        ),
      ),
    ),
  );
}
