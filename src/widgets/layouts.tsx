/**
 * Home-screen widget + Live Activity layouts.
 *
 * Each function is marked 'widget': Expo's Babel plugin turns it into a string
 * that runs inside the widget extension, NOT in the app. So it may only use its
 * own props/environment and @expo/ui SwiftUI components + modifiers (no hooks,
 * no app imports, no helpers from outside the function).
 *
 * The countdown ticks by itself: SwiftUI `Text(timerInterval:)` and
 * `ProgressView(timerInterval:)` count down on the device with no push server
 * and no app running. Times arrive as epoch milliseconds.
 */
import { HStack, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { activityBackgroundTint, background, containerBackground, font, kerning, shapes, foregroundStyle, frame, lineLimit, minimumScaleFactor, monospacedDigit, padding, tint, widgetURL } from '@expo/ui/swift-ui/modifiers';
import type { LiveActivityEnvironment, WidgetEnvironment } from 'expo-widgets';

/** What the app writes for each moment of the day (see src/widgets/index.ts). */
export interface BellProps {
  bg: string;
  ink: string;
  muted: string;
  accent: string;
  /** 'class' | 'passing' | 'before' | 'off' */
  mode: string;
  /** Class name, or "No school" / "Done for today". */
  title: string;
  /** "Period 3 · Room 204", "Passing · Period 4 next", ... */
  label: string;
  /** Countdown window (epoch ms). 0 when there is nothing to count down. */
  start: number;
  end: number;
  /** "Next: English 10:12 AM" or "". */
  next: string;
  /** "Mon · Regular". */
  day: string;
  /** Rest of today, e.g. ["10:12 English", "10:56 Lunch"]. */
  upcoming: string[];
  /**
   * After school: a timer that counts UP from this instant (epoch ms) shows the
   * time of day with seconds, ticking natively. 0 = not used.
   */
  clockFrom: number;
  /** "AM" / "PM" (or "" in 24-hour time). */
  ampm: string;
  /** Second background color: the theme background nudged toward its accent (gradient end). */
  bg2: string;
  /** Readable text color on top of the accent (label pill). */
  onAccent: string;
  /** Number style that matches the theme: 'rounded' | 'serif' | 'monospaced' | 'default'. */
  design: string;
  /** Short name for the compact Dynamic Island: "P3", "Adv", "Lunch". */
  short: string;
  /** "Ends 10:09 AM" (class) or "". */
  ends: string;
  /** Light-on-black colors for the Dynamic Island, which is always black. */
  islandInk: string;
  islandMuted: string;
}

export function BellWidget(props: BellProps, env: WidgetEnvironment) {
  'widget';
  const timing = props.end > 0 && props.end > env.date.getTime();
  const range = { lower: new Date(props.start || env.date.getTime()), upper: new Date(props.end || env.date.getTime()) };
  const clockOn = !timing && props.clockFrom > 0;
  const clockRange = { lower: new Date(props.clockFrom || env.date.getTime()), upper: new Date((props.clockFrom || env.date.getTime()) + 86400000) };
  const big = env.widgetFamily === 'systemLarge';
  const medium = env.widgetFamily === 'systemMedium';
  const design = (props.design || 'rounded') as 'default' | 'rounded' | 'serif' | 'monospaced';
  const wash = { type: 'linearGradient' as const, colors: [props.bg, props.bg2], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } };
  const shell = [containerBackground(wash, 'widget'), widgetURL('studento://')];

  if (env.widgetFamily === 'accessoryInline') {
    if (clockOn) return <Text timerInterval={clockRange} modifiers={[monospacedDigit()]} />;
    return timing ? (
      <Text timerInterval={range} countsDown modifiers={[monospacedDigit()]}>
        {props.title}
      </Text>
    ) : (
      <Text>{props.title}</Text>
    );
  }

  if (env.widgetFamily === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={1} modifiers={[widgetURL('studento://')]}>
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), lineLimit(1)]}>{props.title}</Text>
        {timing ? (
          <Text timerInterval={range} countsDown modifiers={[font({ size: 20, weight: 'bold' }), monospacedDigit()]} />
        ) : clockOn ? (
          <Text timerInterval={clockRange} modifiers={[font({ size: 20, weight: 'bold' }), monospacedDigit()]} />
        ) : (
          <Text modifiers={[font({ size: 13 })]}>{props.label}</Text>
        )}
        {props.next ? <Text modifiers={[font({ size: 11 }), lineLimit(1)]}>{props.next}</Text> : null}
      </VStack>
    );
  }

  // Label pill: accent capsule with readable text.
  const pill = (
    <Text modifiers={[font({ size: 10, weight: 'bold' }), kerning(0.8), foregroundStyle(props.onAccent), padding({ horizontal: 9, vertical: 4 }), background(props.accent, shapes.capsule()), lineLimit(1), minimumScaleFactor(0.7)]}>
      {(props.mode === 'off' ? props.label : props.label).toUpperCase()}
    </Text>
  );
  const title = (size: number) => (
    <Text modifiers={[font({ size, weight: 'bold', design }), foregroundStyle(props.ink), lineLimit(2), minimumScaleFactor(0.6)]}>{props.title}</Text>
  );
  const digits = big ? 66 : medium ? 46 : 38;

  const hero = timing ? (
    <VStack alignment="leading" spacing={8}>
      <Text timerInterval={range} countsDown modifiers={[font({ size: digits, weight: 'heavy', design }), monospacedDigit(), foregroundStyle(props.ink), minimumScaleFactor(0.5), lineLimit(1)]} />
      <ProgressView timerInterval={range} countsDown modifiers={[tint(props.accent)]} />
    </VStack>
  ) : clockOn ? (
    <VStack alignment="leading" spacing={3}>
      <Text timerInterval={clockRange} modifiers={[font({ size: digits, weight: 'heavy', design }), monospacedDigit(), foregroundStyle(props.ink), minimumScaleFactor(0.5), lineLimit(1)]} />
      <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(props.accent)]}>{`${props.ampm ? props.ampm + ' · ' : ''}${props.day}`}</Text>
    </VStack>
  ) : (
    <Text modifiers={[font({ size: 15, weight: 'medium' }), foregroundStyle(props.muted)]}>{props.day}</Text>
  );

  const footer = props.next ? <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle(props.muted), lineLimit(1)]}>{props.next}</Text> : null;

  const later = (max: number, size: number) => (
    <VStack alignment="leading" spacing={7}>
      <Text modifiers={[font({ size: 10, weight: 'bold' }), kerning(1), foregroundStyle(props.muted)]}>LATER TODAY</Text>
      {props.upcoming.slice(0, max).map((u, i) => (
        <HStack key={i} spacing={7}>
          <Text modifiers={[font({ size: size - 4, weight: 'bold' }), foregroundStyle(props.accent)]}>●</Text>
          <Text modifiers={[font({ size, weight: 'medium', design }), foregroundStyle(props.ink), lineLimit(1)]}>{u}</Text>
        </HStack>
      ))}
      {props.upcoming.length === 0 ? <Text modifiers={[font({ size, weight: 'medium' }), foregroundStyle(props.muted)]}>Nothing else today</Text> : null}
    </VStack>
  );

  if (medium) {
    return (
      <HStack spacing={18} modifiers={shell}>
        <VStack alignment="leading" spacing={7}>
          {pill}
          {title(19)}
          <Spacer />
          {hero}
        </VStack>
        <VStack alignment="leading" spacing={9} modifiers={[frame({ maxWidth: 140 })]}>
          {later(4, 13)}
          <Spacer />
          {footer}
        </VStack>
      </HStack>
    );
  }

  if (big) {
    return (
      <VStack alignment="leading" spacing={14} modifiers={[...shell, padding({ all: 4 })]}>
        {pill}
        {title(30)}
        {hero}
        {footer}
        <Spacer />
        {later(6, 16)}
        <Spacer />
      </VStack>
    );
  }

  return (
    <VStack alignment="leading" spacing={7} modifiers={shell}>
      {pill}
      {title(17)}
      <Spacer />
      {hero}
      {footer}
    </VStack>
  );
}

/**
 * Lock Screen banner + Dynamic Island for the current period, in the theme's colors
 * (banner tint = theme background, accent progress bar, number style from the theme).
 * The island is always black, so it uses the light "island" colors.
 */
export function BellActivity(props: BellProps, env: LiveActivityEnvironment) {
  'widget';
  const range = { lower: new Date(props.start), upper: new Date(props.end) };
  const design = (props.design || 'rounded') as 'default' | 'rounded' | 'serif' | 'monospaced';
  const stale = env.isStale === true;
  const timer = (size: number, color: string, weight: 'bold' | 'heavy' = 'bold') => (
    <Text timerInterval={range} countsDown modifiers={[font({ size, weight, design }), monospacedDigit(), foregroundStyle(color), lineLimit(1), minimumScaleFactor(0.5)]} />
  );
  const eyebrow = (color: string) => <Text modifiers={[font({ size: 11, weight: 'semibold' }), kerning(1.1), foregroundStyle(color), lineLimit(1)]}>{props.label.toUpperCase()}</Text>;

  return {
    banner: (
      <VStack alignment="leading" spacing={10} modifiers={[padding({ all: 16 }), activityBackgroundTint(props.bg)]}>
        <HStack spacing={12}>
          <VStack alignment="leading" spacing={3}>
            {eyebrow(props.accent)}
            <Text modifiers={[font({ size: 22, weight: 'bold', design }), foregroundStyle(props.ink), lineLimit(1), minimumScaleFactor(0.6)]}>{props.title}</Text>
          </VStack>
          <Spacer />
          {stale ? <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle(props.muted)]}>Bell rang</Text> : timer(40, props.ink, 'heavy')}
        </HStack>
        {stale ? null : <ProgressView timerInterval={range} countsDown modifiers={[tint(props.accent)]} />}
        <HStack spacing={8}>
          <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle(props.muted), lineLimit(1)]}>{stale ? 'Open Studento for the next class' : props.next}</Text>
          <Spacer />
          {stale || !props.ends ? null : <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(props.accent), lineLimit(1)]}>{props.ends}</Text>}
        </HStack>
      </VStack>
    ),
    // Compact: a filled accent chip for the period + the live countdown.
    compactLeading: (
      <Text modifiers={[font({ size: 12, weight: 'heavy', design }), foregroundStyle(props.onAccent), padding({ horizontal: 8, vertical: 3 }), background(props.accent, shapes.capsule()), lineLimit(1), frame({ maxWidth: 62 })]}>{props.short}</Text>
    ),
    compactTrailing: stale ? (
      <Text modifiers={[foregroundStyle(props.islandMuted)]}>✓</Text>
    ) : (
      <Text timerInterval={range} countsDown modifiers={[font({ size: 15, weight: 'bold', design }), monospacedDigit(), foregroundStyle(props.islandInk), lineLimit(1), minimumScaleFactor(0.6), frame({ maxWidth: 56 })]} />
    ),
    minimal: stale ? (
      <Text modifiers={[foregroundStyle(props.accent)]}>✓</Text>
    ) : (
      <Text timerInterval={range} countsDown modifiers={[font({ size: 11, weight: 'bold', design }), monospacedDigit(), foregroundStyle(props.accent), lineLimit(1), minimumScaleFactor(0.5)]} />
    ),
    // Expanded: chip + end time on the sides, class and a big countdown across the full-width bottom.
    expandedLeading: (
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={[font({ size: 26, weight: 'heavy', design }), foregroundStyle(props.accent), lineLimit(1), minimumScaleFactor(0.6)]}>{props.short}</Text>
        <Text modifiers={[font({ size: 10, weight: 'bold' }), kerning(1.2), foregroundStyle(props.islandMuted)]}>{props.mode === 'class' ? 'NOW' : props.mode === 'passing' ? 'NEXT' : 'SOON'}</Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack alignment="trailing" spacing={2}>
        <Text modifiers={[font({ size: 19, weight: 'bold', design }), foregroundStyle(props.islandInk), lineLimit(1), minimumScaleFactor(0.6)]}>{(props.ends || props.next).replace('Ends ', '').replace('Starts ', '')}</Text>
        <Text modifiers={[font({ size: 10, weight: 'bold' }), kerning(1.2), foregroundStyle(props.islandMuted)]}>{props.ends ? 'ENDS' : 'STARTS'}</Text>
      </VStack>
    ),
    expandedBottom: (
      <VStack alignment="leading" spacing={10}>
        <HStack spacing={10}>
          <VStack alignment="leading" spacing={2}>
            <Text modifiers={[font({ size: 21, weight: 'bold', design }), foregroundStyle(props.islandInk), lineLimit(1), minimumScaleFactor(0.6)]}>{props.title}</Text>
            {eyebrow(props.islandMuted)}
          </VStack>
          <Spacer />
          {stale ? <Text modifiers={[font({ size: 16, weight: 'semibold' }), foregroundStyle(props.islandMuted)]}>Bell rang</Text> : timer(46, props.accent, 'heavy')}
        </HStack>
        {stale ? null : <ProgressView timerInterval={range} countsDown modifiers={[tint(props.accent)]} />}
        <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle(props.islandMuted), lineLimit(1)]}>{stale ? 'Open Studento for the next class' : props.next}</Text>
      </VStack>
    ),
  };
}
