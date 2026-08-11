import { Slider as BaseSlider } from '@base-ui/react/slider';
import { cn } from './cn';
import {
  sliderControlClass,
  sliderIndicatorClass,
  sliderLabelClass,
  sliderLabelRowClass,
  sliderRootRecipe,
  sliderThumbClass,
  sliderTrackClass,
  sliderValueClass,
  sliderWrapperClass,
  type SliderSize,
} from './slider.recipe';

export type SliderProps = {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** Visible label. Also supplies the accessible name unless `aria-label` is given. */
  label?: string;
  'aria-label'?: string;
  /** Preformatted value readout shown beside the label (e.g. "30 min") — formatting stays with the caller. */
  valueLabel?: string;
  size?: SliderSize;
  className?: string;
  id?: string;
  name?: string;
};

/**
 * Slider primitive — wraps `@base-ui/react/slider` (Root/Control/Track/
 * Indicator/Thumb). Dragging, keyboard stepping (arrow keys, Page Up/Down,
 * Home/End), and ARIA value plumbing all come from base-ui — none
 * reimplemented here, per `docs/base-ui-first.md`.
 */
export function Slider({
  value,
  defaultValue,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  label,
  'aria-label': ariaLabel,
  valueLabel,
  size = 'default',
  className,
  id,
  name,
}: SliderProps) {
  const accessibleLabel = ariaLabel ?? label;

  return (
    <div className={cn(sliderWrapperClass, className)}>
      {label || valueLabel ? (
        <div className={sliderLabelRowClass}>
          {label ? <span className={sliderLabelClass}>{label}</span> : <span />}
          {valueLabel ? <span className={sliderValueClass}>{valueLabel}</span> : null}
        </div>
      ) : null}
      <BaseSlider.Root
        value={value}
        defaultValue={defaultValue}
        onValueChange={(next) => onValueChange?.(next)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        id={id}
        name={name}
        className={sliderRootRecipe({ size })}
      >
        <BaseSlider.Control className={sliderControlClass}>
          <BaseSlider.Track className={sliderTrackClass}>
            <BaseSlider.Indicator className={sliderIndicatorClass} />
            <BaseSlider.Thumb
              className={sliderThumbClass}
              getAriaLabel={accessibleLabel ? () => accessibleLabel : undefined}
            />
          </BaseSlider.Track>
        </BaseSlider.Control>
      </BaseSlider.Root>
    </div>
  );
}
