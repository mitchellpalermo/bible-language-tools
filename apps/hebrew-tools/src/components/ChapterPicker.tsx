// The chapter picker is `@tools/shared/components/ChapterPicker`, shared with
// greek.tools (#228). This binds it to this app's accent.

import SharedChapterPicker, {
  type ChapterPickerProps as SharedProps,
} from '@tools/shared/components/ChapterPicker';

export type ChapterPickerProps = Omit<SharedProps, 'accent'>;

export default function ChapterPicker(props: ChapterPickerProps) {
  return <SharedChapterPicker {...props} accent="var(--color-primary, #15803D)" />;
}
