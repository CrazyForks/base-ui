'use client';
import * as React from 'react';
import { getSide, getAlignment, type Rect, getSideAxis } from '@floating-ui/utils';
import { ownerDocument } from '@base-ui-components/utils/owner';
import { useIsoLayoutEffect } from '@base-ui-components/utils/useIsoLayoutEffect';
import { useLatestRef } from '@base-ui-components/utils/useLatestRef';
import { useEventCallback } from '@base-ui-components/utils/useEventCallback';
import {
  autoUpdate,
  flip,
  limitShift,
  offset,
  shift,
  useFloating,
  size,
  hide,
  type UseFloatingOptions,
  type Placement,
  type FloatingRootContext,
  type VirtualElement,
  type Padding,
  type FloatingContext,
  type Side as PhysicalSide,
  type MiddlewareState,
  type AutoUpdateOptions,
  type Middleware,
} from '../floating-ui-react/index';
import { useDirection } from '../direction-provider/DirectionContext';
import { arrow } from '../floating-ui-react/middleware/arrow';

function getLogicalSide(sideParam: Side, renderedSide: PhysicalSide, isRtl: boolean): Side {
  const isLogicalSideParam = sideParam === 'inline-start' || sideParam === 'inline-end';
  const logicalRight = isRtl ? 'inline-start' : 'inline-end';
  const logicalLeft = isRtl ? 'inline-end' : 'inline-start';
  return (
    {
      top: 'top',
      right: isLogicalSideParam ? logicalRight : 'right',
      bottom: 'bottom',
      left: isLogicalSideParam ? logicalLeft : 'left',
    } satisfies Record<PhysicalSide, Side>
  )[renderedSide];
}

function getOffsetData(state: MiddlewareState, sideParam: Side, isRtl: boolean) {
  const { rects, placement } = state;
  const data = {
    side: getLogicalSide(sideParam, getSide(placement), isRtl),
    align: getAlignment(placement) || 'center',
    anchor: { width: rects.reference.width, height: rects.reference.height },
    positioner: { width: rects.floating.width, height: rects.floating.height },
  } as const;
  return data;
}

export type Side = 'top' | 'bottom' | 'left' | 'right' | 'inline-end' | 'inline-start';
export type Align = 'start' | 'center' | 'end';
export type Boundary = 'clipping-ancestors' | Element | Element[] | Rect;
export type OffsetFunction = (data: {
  side: Side;
  align: Align;
  anchor: { width: number; height: number };
  positioner: { width: number; height: number };
}) => number;

interface SideFlipMode {
  /**
   * How to avoid collisions on the side axis.
   */
  side?: 'flip' | 'none';
  /**
   * How to avoid collisions on the align axis.
   */
  align?: 'flip' | 'shift' | 'none';
  /**
   * If both sides on the preferred axis do not fit, determines whether to fallback
   * to a side on the perpendicular axis and which logical side to prefer.
   */
  fallbackAxisSide?: 'start' | 'end' | 'none';
}

interface SideShiftMode {
  /**
   * How to avoid collisions on the side axis.
   */
  side?: 'shift' | 'none';
  /**
   * How to avoid collisions on the align axis.
   */
  align?: 'shift' | 'none';
  /**
   * If both sides on the preferred axis do not fit, determines whether to fallback
   * to a side on the perpendicular axis and which logical side to prefer.
   */
  fallbackAxisSide?: 'start' | 'end' | 'none';
}

export type CollisionAvoidance = SideFlipMode | SideShiftMode;

/**
 * Provides standardized anchor positioning behavior for floating elements. Wraps Floating UI's
 * `useFloating` hook.
 */
export function useAnchorPositioning(
  params: useAnchorPositioning.Parameters,
): useAnchorPositioning.ReturnValue {
  const {
    // Public parameters
    anchor,
    positionMethod = 'absolute',
    side: sideParam = 'bottom',
    sideOffset = 0,
    align = 'center',
    alignOffset = 0,
    collisionBoundary,
    collisionPadding = 5,
    sticky = false,
    arrowPadding = 5,
    trackAnchor = true,
    // Private parameters
    keepMounted = false,
    floatingRootContext,
    mounted,
    collisionAvoidance,
    shiftCrossAxis = false,
    nodeId,
    adaptiveOrigin,
  } = params;

  const collisionAvoidanceSide = collisionAvoidance.side || 'flip';
  const collisionAvoidanceAlign = collisionAvoidance.align || 'flip';
  const collisionAvoidanceFallbackAxisSide = collisionAvoidance.fallbackAxisSide || 'end';

  const anchorFn = typeof anchor === 'function' ? anchor : undefined;
  const anchorFnCallback = useEventCallback(anchorFn);
  const anchorDep = anchorFn ? anchorFnCallback : anchor;
  const anchorValueRef = useLatestRef(anchor);

  const direction = useDirection();
  const isRtl = direction === 'rtl';

  const side = (
    {
      top: 'top',
      right: 'right',
      bottom: 'bottom',
      left: 'left',
      'inline-end': isRtl ? 'left' : 'right',
      'inline-start': isRtl ? 'right' : 'left',
    } satisfies Record<Side, PhysicalSide>
  )[sideParam];

  const placement = align === 'center' ? side : (`${side}-${align}` as Placement);

  const commonCollisionProps = {
    boundary: collisionBoundary === 'clipping-ancestors' ? 'clippingAncestors' : collisionBoundary,
    padding: collisionPadding,
  } as const;

  // Using a ref assumes that the arrow element is always present in the DOM for the lifetime of the
  // popup. If this assumption ends up being false, we can switch to state to manage the arrow's
  // presence.
  const arrowRef = React.useRef<Element | null>(null);

  // Keep these reactive if they're not functions
  const sideOffsetRef = useLatestRef(sideOffset);
  const alignOffsetRef = useLatestRef(alignOffset);
  const sideOffsetDep = typeof sideOffset !== 'function' ? sideOffset : 0;
  const alignOffsetDep = typeof alignOffset !== 'function' ? alignOffset : 0;

  const middleware: UseFloatingOptions['middleware'] = [
    offset(
      (state) => {
        const data = getOffsetData(state, sideParam, isRtl);

        const sideAxis =
          typeof sideOffsetRef.current === 'function'
            ? sideOffsetRef.current(data)
            : sideOffsetRef.current;
        const alignAxis =
          typeof alignOffsetRef.current === 'function'
            ? alignOffsetRef.current(data)
            : alignOffsetRef.current;

        return {
          mainAxis: sideAxis,
          crossAxis: alignAxis,
          alignmentAxis: alignAxis,
        };
      },
      [sideOffsetDep, alignOffsetDep, isRtl, sideParam],
    ),
  ];

  const shiftDisabled = collisionAvoidanceAlign === 'none' && collisionAvoidanceSide !== 'shift';
  const crossAxisShiftEnabled =
    !shiftDisabled && (sticky || shiftCrossAxis || collisionAvoidanceSide === 'shift');

  const flipMiddleware =
    collisionAvoidanceSide === 'none'
      ? null
      : flip({
          ...commonCollisionProps,
          mainAxis: !shiftCrossAxis && collisionAvoidanceSide === 'flip',
          crossAxis: collisionAvoidanceAlign === 'flip' ? 'alignment' : false,
          fallbackAxisSideDirection: collisionAvoidanceFallbackAxisSide,
        });
  const shiftMiddleware = shiftDisabled
    ? null
    : shift(
        (data) => {
          const html = ownerDocument(data.elements.floating).documentElement;
          return {
            ...commonCollisionProps,
            // Use the Layout Viewport to avoid shifting around when pinch-zooming
            // for context menus.
            rootBoundary: shiftCrossAxis
              ? { x: 0, y: 0, width: html.clientWidth, height: html.clientHeight }
              : undefined,
            mainAxis: collisionAvoidanceAlign !== 'none',
            crossAxis: crossAxisShiftEnabled,
            limiter:
              sticky || shiftCrossAxis
                ? undefined
                : limitShift(() => {
                    if (!arrowRef.current) {
                      return {};
                    }
                    const { height } = arrowRef.current.getBoundingClientRect();
                    return {
                      offset:
                        height / 2 + (typeof collisionPadding === 'number' ? collisionPadding : 0),
                    };
                  }),
          };
        },
        [commonCollisionProps, sticky, shiftCrossAxis, collisionPadding, collisionAvoidanceAlign],
      );

  // https://floating-ui.com/docs/flip#combining-with-shift
  if (
    collisionAvoidanceSide === 'shift' ||
    collisionAvoidanceAlign === 'shift' ||
    align === 'center'
  ) {
    middleware.push(shiftMiddleware, flipMiddleware);
  } else {
    middleware.push(flipMiddleware, shiftMiddleware);
  }

  middleware.push(
    size({
      ...commonCollisionProps,
      apply({ elements: { floating }, rects: { reference }, availableWidth, availableHeight }) {
        Object.entries({
          '--available-width': `${availableWidth}px`,
          '--available-height': `${availableHeight}px`,
          '--anchor-width': `${reference.width}px`,
          '--anchor-height': `${reference.height}px`,
        }).forEach(([key, value]) => {
          floating.style.setProperty(key, value);
        });
      },
    }),
    arrow(
      () => ({
        // `transform-origin` calculations rely on an element existing. If the arrow hasn't been set,
        // we'll create a fake element.
        element: arrowRef.current || document.createElement('div'),
        padding: arrowPadding,
        offsetParent: 'floating',
      }),
      [arrowPadding],
    ),
    hide(),
    {
      name: 'transformOrigin',
      fn(state) {
        const { elements, middlewareData, placement: renderedPlacement, rects, y } = state;

        const currentRenderedSide = getSide(renderedPlacement);
        const currentRenderedAxis = getSideAxis(currentRenderedSide);
        const arrowEl = arrowRef.current;
        const arrowX = middlewareData.arrow?.x || 0;
        const arrowY = middlewareData.arrow?.y || 0;
        const arrowWidth = arrowEl?.clientWidth || 0;
        const arrowHeight = arrowEl?.clientHeight || 0;
        const transformX = arrowX + arrowWidth / 2;
        const transformY = arrowY + arrowHeight / 2;
        const shiftY = Math.abs(middlewareData.shift?.y || 0);
        const halfAnchorHeight = rects.reference.height / 2;
        const isOverlappingAnchor =
          shiftY >
          (typeof sideOffset === 'function'
            ? sideOffset(getOffsetData(state, sideParam, isRtl))
            : sideOffset);

        const adjacentTransformOrigin = {
          top: `${transformX}px calc(100% + ${sideOffset}px)`,
          bottom: `${transformX}px ${-sideOffset}px`,
          left: `calc(100% + ${sideOffset}px) ${transformY}px`,
          right: `${-sideOffset}px ${transformY}px`,
        }[currentRenderedSide];
        const overlapTransformOrigin = `${transformX}px ${rects.reference.y + halfAnchorHeight - y}px`;

        elements.floating.style.setProperty(
          '--transform-origin',
          crossAxisShiftEnabled && currentRenderedAxis === 'y' && isOverlappingAnchor
            ? overlapTransformOrigin
            : adjacentTransformOrigin,
        );

        return {};
      },
    },
    adaptiveOrigin,
  );

  // Ensure positioning doesn't run initially for `keepMounted` elements that
  // aren't initially open.
  let rootContext = floatingRootContext;
  if (!mounted && floatingRootContext) {
    rootContext = {
      ...floatingRootContext,
      elements: { reference: null, floating: null, domReference: null },
    };
  }

  const autoUpdateOptions: AutoUpdateOptions = React.useMemo(
    () => ({
      elementResize: trackAnchor && typeof ResizeObserver !== 'undefined',
      layoutShift: trackAnchor && typeof IntersectionObserver !== 'undefined',
    }),
    [trackAnchor],
  );

  const {
    refs,
    elements,
    x,
    y,
    middlewareData,
    update,
    placement: renderedPlacement,
    context,
    isPositioned,
    floatingStyles: originalFloatingStyles,
  } = useFloating({
    rootContext,
    placement,
    middleware,
    strategy: positionMethod,
    whileElementsMounted: keepMounted
      ? undefined
      : (...args) => autoUpdate(...args, autoUpdateOptions),
    nodeId,
  });

  const { sideX, sideY } = middlewareData.adaptiveOrigin || {};

  const floatingStyles = React.useMemo<React.CSSProperties>(
    () =>
      adaptiveOrigin
        ? { position: positionMethod, [sideX]: `${x}px`, [sideY]: `${y}px` }
        : originalFloatingStyles,
    [adaptiveOrigin, sideX, sideY, positionMethod, x, y, originalFloatingStyles],
  );

  const registeredPositionReferenceRef = React.useRef<Element | VirtualElement | null>(null);

  useIsoLayoutEffect(() => {
    if (!mounted) {
      return;
    }

    const anchorValue = anchorValueRef.current;
    const resolvedAnchor = typeof anchorValue === 'function' ? anchorValue() : anchorValue;
    const unwrappedElement =
      (isRef(resolvedAnchor) ? resolvedAnchor.current : resolvedAnchor) || null;
    const finalAnchor = unwrappedElement || null;

    if (finalAnchor !== registeredPositionReferenceRef.current) {
      refs.setPositionReference(finalAnchor);
      registeredPositionReferenceRef.current = finalAnchor;
    }
  }, [mounted, refs, anchorDep, anchorValueRef]);

  React.useEffect(() => {
    if (!mounted) {
      return;
    }

    const anchorValue = anchorValueRef.current;

    // Refs from parent components are set after useLayoutEffect runs and are available in useEffect.
    // Therefore, if the anchor is a ref, we need to update the position reference in useEffect.
    if (typeof anchorValue === 'function') {
      return;
    }

    if (isRef(anchorValue) && anchorValue.current !== registeredPositionReferenceRef.current) {
      refs.setPositionReference(anchorValue.current);
      registeredPositionReferenceRef.current = anchorValue.current;
    }
  }, [mounted, refs, anchorDep, anchorValueRef]);

  React.useEffect(() => {
    if (keepMounted && mounted && elements.domReference && elements.floating) {
      return autoUpdate(elements.domReference, elements.floating, update, autoUpdateOptions);
    }
    return undefined;
  }, [keepMounted, mounted, elements, update, autoUpdateOptions]);

  const renderedSide = getSide(renderedPlacement);
  const logicalRenderedSide = getLogicalSide(sideParam, renderedSide, isRtl);
  const renderedAlign = getAlignment(renderedPlacement) || 'center';
  const anchorHidden = Boolean(middlewareData.hide?.referenceHidden);

  const arrowStyles = React.useMemo(
    () => ({
      position: 'absolute' as const,
      top: middlewareData.arrow?.y,
      left: middlewareData.arrow?.x,
    }),
    [middlewareData.arrow],
  );

  const arrowUncentered = middlewareData.arrow?.centerOffset !== 0;

  return React.useMemo(
    () => ({
      positionerStyles: floatingStyles,
      arrowStyles,
      arrowRef,
      arrowUncentered,
      side: logicalRenderedSide,
      align: renderedAlign,
      anchorHidden,
      refs,
      context,
      isPositioned,
      update,
    }),
    [
      floatingStyles,
      arrowStyles,
      arrowRef,
      arrowUncentered,
      logicalRenderedSide,
      renderedAlign,
      anchorHidden,
      refs,
      context,
      isPositioned,
      update,
    ],
  );
}

function isRef(
  param: Element | VirtualElement | React.RefObject<any> | null | undefined,
): param is React.RefObject<any> {
  return param != null && 'current' in param;
}

export namespace useAnchorPositioning {
  export interface SharedParameters {
    /**
     * An element to position the popup against.
     * By default, the popup will be positioned against the trigger.
     */
    anchor?:
      | Element
      | null
      | VirtualElement
      | React.RefObject<Element | null>
      | (() => Element | VirtualElement | null);
    /**
     * Determines which CSS `position` property to use.
     * @default 'absolute'
     */
    positionMethod?: 'absolute' | 'fixed';
    /**
     * Which side of the anchor element to align the popup against.
     * May automatically change to avoid collisions.
     * @default 'bottom'
     */
    side?: Side;
    /**
     * Distance between the anchor and the popup in pixels.
     * Also accepts a function that returns the distance to read the dimensions of the anchor
     * and positioner elements, along with its side and alignment.
     *
     * - `data.anchor`: the dimensions of the anchor element with properties `width` and `height`.
     * - `data.positioner`: the dimensions of the positioner element with properties `width` and `height`.
     * - `data.side`: which side of the anchor element the positioner is aligned against.
     * - `data.align`: how the positioner is aligned relative to the specified side.
     * @default 0
     */
    sideOffset?: number | OffsetFunction;
    /**
     * How to align the popup relative to the specified side.
     * @default 'center'
     */
    align?: 'start' | 'end' | 'center';
    /**
     * Additional offset along the alignment axis in pixels.
     * Also accepts a function that returns the offset to read the dimensions of the anchor
     * and positioner elements, along with its side and alignment.
     *
     * - `data.anchor`: the dimensions of the anchor element with properties `width` and `height`.
     * - `data.positioner`: the dimensions of the positioner element with properties `width` and `height`.
     * - `data.side`: which side of the anchor element the positioner is aligned against.
     * - `data.align`: how the positioner is aligned relative to the specified side.
     * @default 0
     */
    alignOffset?: number | OffsetFunction;
    /**
     * An element or a rectangle that delimits the area that the popup is confined to.
     * @default 'clipping-ancestors'
     */
    collisionBoundary?: Boundary;
    /**
     * Additional space to maintain from the edge of the collision boundary.
     * @default 5
     */
    collisionPadding?: Padding;
    /**
     * Whether to maintain the popup in the viewport after
     * the anchor element was scrolled out of view.
     * @default false
     */
    sticky?: boolean;
    /**
     * Minimum distance to maintain between the arrow and the edges of the popup.
     *
     * Use it to prevent the arrow element from hanging out of the rounded corners of a popup.
     * @default 5
     */
    arrowPadding?: number;
    /**
     * Whether the popup tracks any layout shift of its positioning anchor.
     * @default true
     */
    trackAnchor?: boolean;
    /**
     * Determines how to handle collisions when positioning the popup.
     */
    collisionAvoidance?: CollisionAvoidance;
  }

  export interface Parameters extends SharedParameters {
    keepMounted?: boolean;
    trackCursorAxis?: 'none' | 'x' | 'y' | 'both';
    floatingRootContext?: FloatingRootContext;
    mounted: boolean;
    trackAnchor: boolean;
    nodeId?: string;
    adaptiveOrigin?: Middleware;
    collisionAvoidance: CollisionAvoidance;
    shiftCrossAxis?: boolean;
  }

  export interface ReturnValue {
    positionerStyles: React.CSSProperties;
    arrowStyles: React.CSSProperties;
    arrowRef: React.RefObject<Element | null>;
    arrowUncentered: boolean;
    side: Side;
    align: Align;
    anchorHidden: boolean;
    refs: ReturnType<typeof useFloating>['refs'];
    context: FloatingContext;
    isPositioned: boolean;
    update: () => void;
  }
}
