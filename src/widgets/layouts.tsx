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
import { activityBackgroundTint, containerBackground, font, foregroundStyle, frame, lineLimit, minimumScaleFactor, monospacedDigit, padding, tint, widgetURL } from '@expo/ui/swift-ui/modifiers';
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
  /** Every period of today, "8:00 AM Math". */
  rows: string[];
  /** Index of the class happening now in rows, or -1. */
  cur: number;
  /** Index of the next class in rows, or -1. */
  nxt: number;
  /** "Mon, Oct 19". */
  date: string;
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
  const clockOn = props.clockFrom > 0 && !(props.end > 0 && props.end > env.date.getTime() && true);
  const clockRange = { lower: new Date(props.clockFrom || env.date.getTime()), upper: new Date((props.clockFrom || env.date.getTime()) + 86400000) };
  const big = env.widgetFamily === 'systemLarge' || env.widgetFamily === 'systemExtraLarge';
  const medium = env.widgetFamily === 'systemMedium';
  const design = (props.design || 'rounded') as 'default' | 'rounded' | 'serif' | 'monospaced';
  const shell = [containerBackground(props.bg, 'widget'), widgetURL('studento://')];

  // Lock Screen: circle, inline, rectangle.
  if (env.widgetFamily === 'accessoryCircular') {
    return (
      <VStack spacing={0} modifiers={[widgetURL('studento://')]}>
        <Text modifiers={[font({ size: 11, weight: 'bold' }), lineLimit(1)]}>{timing ? props.short : props.ampm || 'NOW'}</Text>
        {timing ? (
          <Text timerInterval={range} countsDown modifiers={[font({ size: 17, weight: 'bold' }), monospacedDigit(), lineLimit(1), minimumScaleFactor(0.4)]} />
        ) : clockOn ? (
          <Text timerInterval={clockRange} modifiers={[font({ size: 13, weight: 'bold' }), monospacedDigit(), lineLimit(1), minimumScaleFactor(0.4)]} />
        ) : (
          <Text modifiers={[font({ size: 12, weight: 'bold' })]}>–</Text>
        )}
      </VStack>
    );
  }
  if (env.widgetFamily === 'accessoryInline') {
    if (false) return <Text timerInterval={clockRange} modifiers={[monospacedDigit()]} />;
    if (timing && !false) {
      return (
        <Text timerInterval={range} countsDown modifiers={[monospacedDigit()]}>
          {props.title}
        </Text>
      );
    }
    return clockOn ? <Text timerInterval={clockRange} modifiers={[monospacedDigit()]} /> : <Text>{props.title}</Text>;
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

  // Minimal: one line of text, one big number. Nothing else.
  const size = big ? 84 : medium ? 60 : 44;
  const digitMods = [font({ size, weight: 'heavy', design }), monospacedDigit(), foregroundStyle(props.accent), minimumScaleFactor(0.5), lineLimit(1)];
  const hero = timing ? (
    <Text timerInterval={range} countsDown modifiers={digitMods} />
  ) : clockOn ? (
    <Text timerInterval={clockRange} modifiers={digitMods} />
  ) : (
    <Text modifiers={[font({ size: 24, weight: 'bold', design }), foregroundStyle(props.ink)]}>{props.title}</Text>
  );
  const heading = timing ? props.title : clockOn ? `${props.ampm ? props.ampm + ' · ' : ''}${props.day}` : props.day;
  const top = (
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={[font({ size: big ? 20 : 15, weight: 'semibold', design }), foregroundStyle(props.ink), lineLimit(1), minimumScaleFactor(0.7)]}>{heading}</Text>
      {timing ? <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle(props.muted), lineLimit(1)]}>{props.label}</Text> : null}
    </VStack>
  );
  const next = props.next ? <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle(props.muted), lineLimit(2)]}>{props.next}</Text> : null;

  if (medium) {
    return (
      <HStack spacing={16} modifiers={shell}>
        <VStack alignment="leading" spacing={4}>
          {top}
          <Spacer />
          {hero}
        </VStack>
        <VStack alignment="trailing" spacing={4}>
          <Spacer />
          {next}
        </VStack>
      </HStack>
    );
  }
  return (
    <VStack alignment="leading" spacing={big ? 10 : 4} modifiers={shell}>
      {top}
      <Spacer />
      {hero}
      {big ? next : null}
    </VStack>
  );
}

/** A plain, always-on clock with seconds, in the theme's colors. */
export function ClockWidget(props: BellProps, env: WidgetEnvironment) {
  'widget';
  const timing = props.end > 0 && props.end > env.date.getTime();
  const range = { lower: new Date(props.start || env.date.getTime()), upper: new Date(props.end || env.date.getTime()) };
  const clockOn = props.clockFrom > 0 && !(props.end > 0 && props.end > env.date.getTime() && false);
  const clockRange = { lower: new Date(props.clockFrom || env.date.getTime()), upper: new Date((props.clockFrom || env.date.getTime()) + 86400000) };
  const big = env.widgetFamily === 'systemLarge' || env.widgetFamily === 'systemExtraLarge';
  const medium = env.widgetFamily === 'systemMedium';
  const design = (props.design || 'rounded') as 'default' | 'rounded' | 'serif' | 'monospaced';
  const shell = [containerBackground(props.bg, 'widget'), widgetURL('studento://')];

  // Lock Screen: circle, inline, rectangle.
  if (env.widgetFamily === 'accessoryCircular') {
    return (
      <VStack spacing={0} modifiers={[widgetURL('studento://')]}>
        <Text modifiers={[font({ size: 11, weight: 'bold' }), lineLimit(1)]}>{props.ampm || 'NOW'}</Text>
        {clockOn ? (
          <Text timerInterval={clockRange} modifiers={[font({ size: 13, weight: 'bold' }), monospacedDigit(), lineLimit(1), minimumScaleFactor(0.4)]} />
        ) : clockOn ? (
          <Text timerInterval={clockRange} modifiers={[font({ size: 13, weight: 'bold' }), monospacedDigit(), lineLimit(1), minimumScaleFactor(0.4)]} />
        ) : (
          <Text modifiers={[font({ size: 12, weight: 'bold' })]}>–</Text>
        )}
      </VStack>
    );
  }
  if (env.widgetFamily === 'accessoryInline') {
    if (clockOn) return <Text timerInterval={clockRange} modifiers={[monospacedDigit()]} />;
    if (timing && !true) {
      return (
        <Text timerInterval={range} countsDown modifiers={[monospacedDigit()]}>
          {props.title}
        </Text>
      );
    }
    return clockOn ? <Text timerInterval={clockRange} modifiers={[monospacedDigit()]} /> : <Text>{props.title}</Text>;
  }
  if (env.widgetFamily === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={1} modifiers={[widgetURL('studento://')]}>
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), lineLimit(1)]}>{props.title}</Text>
        {false ? (
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

  const size = big ? 92 : medium ? 66 : 42;
  const clock =
    props.clockFrom > 0 ? (
      <Text timerInterval={clockRange} modifiers={[font({ size, weight: 'heavy', design }), monospacedDigit(), foregroundStyle(props.accent), minimumScaleFactor(0.5), lineLimit(1)]} />
    ) : (
      <Text modifiers={[font({ size: 24, weight: 'bold', design }), foregroundStyle(props.ink)]}>{props.title}</Text>
    );
  return (
    <VStack alignment="leading" spacing={4} modifiers={shell}>
      <Spacer />
      {clock}
      <Text modifiers={[font({ size: big ? 18 : 13, weight: 'medium', design }), foregroundStyle(props.muted), lineLimit(1)]}>{`${props.ampm ? props.ampm + ' · ' : ''}${props.date}`}</Text>
    </VStack>
  );
}

/** Today's classes as a quiet list: now in the accent color, later in ink, done in grey. */
export function DayWidget(props: BellProps, env: WidgetEnvironment) {
  'widget';
  const big = env.widgetFamily === 'systemLarge' || env.widgetFamily === 'systemExtraLarge';
  const design = (props.design || 'rounded') as 'default' | 'rounded' | 'serif' | 'monospaced';
  const shell = [containerBackground(props.bg, 'widget'), widgetURL('studento://')];
  const max = big ? 9 : 5;
  const focus = props.cur >= 0 ? props.cur : props.nxt >= 0 ? props.nxt : 0;
  const start = Math.max(0, Math.min(focus - 1, props.rows.length - max));
  const doneBefore = props.cur >= 0 ? props.cur : props.nxt >= 0 ? props.nxt : props.rows.length;
  const shown = props.rows.slice(start, start + max).map((row, i) => ({ row, idx: start + i }));
  return (
    <VStack alignment="leading" spacing={big ? 9 : 5} modifiers={shell}>
      <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(props.muted)]}>{props.date}</Text>
      {shown.length === 0 ? <Text modifiers={[font({ size: 17, weight: 'semibold', design }), foregroundStyle(props.ink)]}>No school today</Text> : null}
      {shown.map((r) => (
        <Text
          key={r.idx}
          modifiers={[
            font({ size: big ? 17 : 14, weight: r.idx === props.cur ? 'bold' : 'medium', design }),
            foregroundStyle(r.idx === props.cur ? props.accent : r.idx < doneBefore ? props.muted : props.ink),
            lineLimit(1),
          ]}
        >
          {r.row}
        </Text>
      ))}
      <Spacer />
    </VStack>
  );
}

/**
 * Lock Screen banner + Dynamic Island for the current period. Deliberately simple:
 * the class, one quiet line, one big countdown, one thin progress bar. The banner is
 * tinted with the theme background; the island is always black, so it uses the light
 * "island" colors.
 */
export function BellActivity(props: BellProps, env: LiveActivityEnvironment) {
  'widget';
  const range = { lower: new Date(props.start), upper: new Date(props.end) };
  const design = (props.design || 'rounded') as 'default' | 'rounded' | 'serif' | 'monospaced';
  const stale = env.isStale === true;
  const digits = (size: number, color: string) => (
    <Text timerInterval={range} countsDown modifiers={[font({ size, weight: 'heavy', design }), monospacedDigit(), foregroundStyle(color), lineLimit(1), minimumScaleFactor(0.6)]} />
  );
  // "Period 3 · Room 204", or the next class while passing.
  const subtitle = stale ? 'Open Studento for the next class' : props.label;

  return {
    banner: (
      <VStack alignment="leading" spacing={12} modifiers={[padding({ horizontal: 18, vertical: 16 }), activityBackgroundTint(props.bg)]}>
        <HStack spacing={12}>
          <VStack alignment="leading" spacing={3}>
            <Text modifiers={[font({ size: 22, weight: 'bold', design }), foregroundStyle(props.ink), lineLimit(1), minimumScaleFactor(0.6)]}>{props.title}</Text>
            <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle(props.muted), lineLimit(1)]}>{subtitle}</Text>
          </VStack>
          <Spacer />
          {stale ? <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle(props.muted)]}>Bell rang</Text> : digits(40, props.ink)}
        </HStack>
        {stale ? null : <ProgressView timerInterval={range} countsDown modifiers={[tint(props.accent)]} />}
      </VStack>
    ),
    compactLeading: <Text modifiers={[font({ size: 14, weight: 'bold', design }), foregroundStyle(props.accent), lineLimit(1), frame({ maxWidth: 52 })]}>{props.short}</Text>,
    compactTrailing: stale ? (
      <Text modifiers={[foregroundStyle(props.islandMuted)]}>✓</Text>
    ) : (
      <Text timerInterval={range} countsDown modifiers={[font({ size: 14, weight: 'semibold', design }), monospacedDigit(), foregroundStyle(props.islandInk), lineLimit(1), minimumScaleFactor(0.6), frame({ maxWidth: 54 })]} />
    ),
    minimal: stale ? (
      <Text modifiers={[foregroundStyle(props.accent)]}>✓</Text>
    ) : (
      <Text timerInterval={range} countsDown modifiers={[font({ size: 11, weight: 'bold', design }), monospacedDigit(), foregroundStyle(props.accent), lineLimit(1), minimumScaleFactor(0.5)]} />
    ),
    // Expanded: class on the left, countdown on the right, a thin progress bar under both.
    expandedLeading: (
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={[font({ size: 18, weight: 'bold', design }), foregroundStyle(props.islandInk), lineLimit(1), minimumScaleFactor(0.6)]}>{props.title}</Text>
        <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle(props.islandMuted), lineLimit(1)]}>{subtitle}</Text>
      </VStack>
    ),
    expandedTrailing: stale ? <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle(props.islandMuted)]}>Bell rang</Text> : digits(34, props.accent),
    expandedBottom: stale ? <Text modifiers={[font({ size: 13 }), foregroundStyle(props.islandMuted)]}>Open Studento for the next class</Text> : <ProgressView timerInterval={range} countsDown modifiers={[tint(props.accent)]} />,
  };
}
