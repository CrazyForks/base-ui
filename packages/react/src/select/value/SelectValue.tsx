'use client';
import * as React from 'react';
import { useStore } from '@base-ui-components/utils/store';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useSelectRootContext } from '../root/SelectRootContext';
import { selectors } from '../store';
import { CustomStyleHookMapping } from '../../utils/getStyleHookProps';

const customStyleHookMapping: CustomStyleHookMapping<SelectValue.State> = {
  value: () => null,
};

/**
 * A text label of the currently selected item.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export const SelectValue = React.forwardRef(function SelectValue(
  componentProps: SelectValue.Props,
  forwardedRef: React.ForwardedRef<HTMLSpanElement>,
) {
  const { className, render, children: childrenProp, ...elementProps } = componentProps;

  const { store, valueRef } = useSelectRootContext();
  const value = useStore(store, selectors.value);
  const items = useStore(store, selectors.items);
  const isChildrenPropFunction = typeof childrenProp === 'function';

  const labelFromItems = React.useMemo(() => {
    if (isChildrenPropFunction) {
      return undefined;
    }

    // `multiple` selects should always use a custom `children` render function
    if (Array.isArray(value)) {
      return value.join(', ');
    }

    if (!items) {
      return undefined;
    }

    if (Array.isArray(items)) {
      return items.find((item) => item.value === value)?.label;
    }

    return items[value];
  }, [value, items, isChildrenPropFunction]);

  const state: SelectValue.State = React.useMemo(
    () => ({
      value,
    }),
    [value],
  );

  const children =
    typeof childrenProp === 'function'
      ? childrenProp(value)
      : (childrenProp ?? labelFromItems ?? value);

  const element = useRenderElement('span', componentProps, {
    state,
    ref: [forwardedRef, valueRef],
    props: [{ children }, elementProps],
    customStyleHookMapping,
  });

  return element;
});

export namespace SelectValue {
  export interface Props extends Omit<BaseUIComponentProps<'span', State>, 'children'> {
    /**
     * Accepts a function that returns a `ReactNode` to format the selected value.
     * @example
     * ```tsx
     * <Select.Value>
     *   {(value: string | null) => value ? labels[value] : 'No value'}
     * </Select.Value>
     * ```
     */
    children?: React.ReactNode | ((value: any) => React.ReactNode);
  }

  export interface State {
    /**
     * The value of the currently selected item.
     */
    value: any;
  }
}
