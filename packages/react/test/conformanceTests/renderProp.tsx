import * as React from 'react';
import { expect } from 'chai';
import { randomStringValue } from '@mui/internal-test-utils';
import type {
  ConformantComponentProps,
  BaseUiConformanceTestsOptions,
} from '../describeConformance';
import { throwMissingPropError } from './utils';

export function testRenderProp(
  element: React.ReactElement<ConformantComponentProps>,
  getOptions: () => BaseUiConformanceTestsOptions,
) {
  const { render, testRenderPropWith: Element = 'div', button = false } = getOptions();

  if (!render) {
    throwMissingPropError('render');
  }

  const nativeButton = Element === 'button';

  const Wrapper = React.forwardRef<any, { children?: React.ReactNode }>(
    function Wrapper(props, forwardedRef) {
      return (
        <div data-testid="base-ui-wrapper">
          {/* @ts-ignore */}
          <Element ref={forwardedRef} {...props} data-testid="wrapped" />
        </div>
      );
    },
  );

  describe('prop: render', () => {
    it('renders a customized root element with a function', async () => {
      const testValue = randomStringValue();
      const { queryByTestId } = await render(
        React.cloneElement(element, {
          render: (props: {}) => <Wrapper {...props} data-test-value={testValue} />,
          ...(button && { nativeButton }),
        }),
      );

      expect(queryByTestId('base-ui-wrapper')).not.to.equal(null);
      expect(queryByTestId('wrapped')).not.to.equal(null);
      expect(queryByTestId('wrapped')).to.have.attribute('data-test-value', testValue);
    });

    it('renders a customized root element with an element', async () => {
      const testValue = randomStringValue();
      const { queryByTestId } = await render(
        React.cloneElement(element, {
          render: <Wrapper data-test-value={testValue} />,
          ...(button && { nativeButton }),
        }),
      );

      expect(queryByTestId('base-ui-wrapper')).not.to.equal(null);
      expect(queryByTestId('wrapped')).not.to.equal(null);
      expect(queryByTestId('wrapped')).to.have.attribute('data-test-value', testValue);
    });

    it('renders a customized root element with an element', async () => {
      await render(
        React.cloneElement(element, {
          render: <Wrapper />,
          ...(button && { nativeButton: Element === 'button' }),
        }),
      );

      expect(document.querySelector('[data-testid="base-ui-wrapper"]')).not.to.equal(null);
    });

    it('should pass the ref to the custom component', async () => {
      let instanceFromRef = null;

      function Test() {
        return React.cloneElement(element, {
          ref: (el: HTMLElement | null) => {
            instanceFromRef = el;
          },
          render: (props: {}) => <Wrapper {...props} />,
          'data-testid': 'wrapped',
          ...(button && { nativeButton }),
        });
      }

      await render(<Test />);
      expect(instanceFromRef!.tagName).to.equal(Element.toUpperCase());
      expect(instanceFromRef!).to.have.attribute('data-testid', 'wrapped');
    });

    it('should merge the rendering element ref with the custom component ref', async () => {
      let refA = null;
      let refB = null;

      function Test() {
        return React.cloneElement(element, {
          ref: (el: HTMLElement | null) => {
            refA = el;
          },
          render: (
            <Wrapper
              ref={(el: HTMLElement | null) => {
                refB = el;
              }}
            />
          ),
          'data-testid': 'wrapped',
          ...(button && { nativeButton }),
        });
      }

      await render(<Test />);

      expect(refA).not.to.equal(null);
      expect(refA!.tagName).to.equal(Element.toUpperCase());
      expect(refA!).to.have.attribute('data-testid', 'wrapped');
      expect(refB).not.to.equal(null);
      expect(refB!.tagName).to.equal(Element.toUpperCase());
      expect(refB!).to.have.attribute('data-testid', 'wrapped');
    });

    it('should merge the rendering element className with the custom component className', async () => {
      function Test() {
        return React.cloneElement(element, {
          className: 'component-classname',
          render: <Element className="render-prop-classname" />,
          'data-testid': 'test-component',
          ...(button && { nativeButton }),
        });
      }

      const { getByTestId } = await render(<Test />);

      const component = getByTestId('test-component');
      expect(component.classList.contains('component-classname')).to.equal(true);
      expect(component.classList.contains('render-prop-classname')).to.equal(true);
    });

    it('should merge the rendering element resolved className with the custom component className', async () => {
      function Test() {
        return React.cloneElement(element, {
          className: () => 'conditional-component-classname',
          render: <Element className="render-prop-classname" />,
          'data-testid': 'test-component',
          ...(button && { nativeButton }),
        });
      }

      const { getByTestId } = await render(<Test />);

      const component = getByTestId('test-component');
      expect(component.classList.contains('conditional-component-classname')).to.equal(true);
      expect(component.classList.contains('render-prop-classname')).to.equal(true);
    });
  });
}
