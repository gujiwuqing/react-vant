import React, { useCallback, useEffect, useState } from 'react';
import { extend, isObject } from '../utils';
import { resolveContainer } from '../utils/dom/getContainer';
import { lockClick } from './lock-click';
import { ToastProps, ToastInstance, ToastReturnType, ToastType } from './PropsType';
import BaseToast from './Toast';
import { render, unmount } from '../utils/dom/render';

const defaultOptions: ToastProps = {
  message: '',
  className: '',
  type: 'info',
  position: 'middle',
  forbidClick: false,
  duration: 2000,
  teleport: () => document.body,
};

const toastArray: (() => void)[] = [];
let allowMultiple = false;
let currentOptions = extend({}, defaultOptions);
// default options of specific type
const defaultOptionsMap = new Map<string, ToastProps>();

// 同步的销毁
function syncClear() {
  let fn = toastArray.pop();
  while (fn) {
    fn();
    fn = toastArray.pop();
  }
}

// 针对 toast 还没弹出来就立刻销毁的情况，将销毁放到下一个 event loop 中，避免销毁失败。
function nextTickClear() {
  setTimeout(syncClear);
}

// 可返回用于销毁此弹窗的方法
const ToastObj = (p: ToastProps): unknown => {
  const props = parseOptions(p);
  const update: ToastReturnType = {
    config: () => {},
    clear: () => null,
  };
  let timer = 0;
  const { onClose, teleport } = props;
  const container = document.createElement('div');
  const bodyContainer = resolveContainer(teleport);
  bodyContainer.appendChild(container);

  const TempToast = () => {
    const options = {
      duration: 2000,
      ...props,
    } as ToastProps;
    const [visible, setVisible] = useState(false);
    const [state, setState] = useState<ToastProps>({ ...options });
    // clearDOM after animation
    const internalOnClosed = useCallback(() => {
      if (state.forbidClick) {
        lockClick(false);
      }
      const unmountResult = unmount(container);
      if (unmountResult && container.parentNode) {
        container.parentNode.removeChild(container);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [container]);

    // close with animation
    const destroy = useCallback(() => {
      setVisible(false);
      if (onClose) onClose();
    }, []);

    update.clear = internalOnClosed;

    update.config = useCallback(
      (nextState) => {
        setState((prev) =>
          typeof nextState === 'function'
            ? { ...prev, ...nextState(prev) }
            : { ...prev, ...nextState },
        );
      },
      [setState],
    );

    useEffect(() => {
      setVisible(true);
      if (!allowMultiple) syncClear();
      toastArray.push(internalOnClosed);

      if (state.duration !== 0 && 'duration' in state) {
        timer = window.setTimeout(destroy, +state.duration);
      }
      return () => {
        if (timer !== 0) {
          window.clearTimeout(timer);
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <BaseToast
        {...state}
        visible={visible}
        teleport={() => container}
        onClose={destroy}
        onClosed={internalOnClosed}
      />
    );
  };

  render(<TempToast />, container);

  return update;
};

function parseOptions(message) {
  if (isObject(message)) {
    return message;
  }
  return { message };
}

const createMethod = (type) => (options) =>
  ToastObj({
    ...currentOptions,
    ...defaultOptionsMap.get(type),
    ...parseOptions(options),
    type,
  });

['info', 'loading', 'success', 'fail'].forEach((method) => {
  ToastObj[method] = createMethod(method);
});

ToastObj.allowMultiple = (value = true) => {
  allowMultiple = value;
};
ToastObj.clear = nextTickClear;

function setDefaultOptions(type: ToastType | ToastProps, options?: ToastProps) {
  if (typeof type === 'string') {
    defaultOptionsMap.set(type, options);
  } else {
    extend(currentOptions, type);
  }
}

ToastObj.setDefaultOptions = setDefaultOptions;

ToastObj.resetDefaultOptions = (type?: ToastType) => {
  if (typeof type === 'string') {
    defaultOptionsMap.delete(type);
  } else {
    currentOptions = extend({}, defaultOptions);
    defaultOptionsMap.clear();
  }
};

const Toast = ToastObj as ToastInstance;
export default Toast as ToastInstance;
