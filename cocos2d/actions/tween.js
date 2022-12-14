import { bezier } from '../animation/bezier';

let _tweenID = 0;

let TweenAction = cc.Class({
    name: 'cc.TweenAction',
    extends: cc.ActionInterval,

    ctor (duration, props, opts) {
        this._opts = opts = opts || Object.create(null);
        this._props = Object.create(null);

        // global easing or progress used for this action
        opts.progress = opts.progress || this.progress;
        if (opts.easing && typeof opts.easing === 'string') {
            let easingName = opts.easing;
            opts.easing = cc.easing[easingName];
            !opts.easing && cc.warnID(1031, easingName);
        }

        let relative = this._opts.relative;

        for (let name in props) {
            let value = props[name];

            // property may have custom easing or progress function
            let easing, progress;
            if (value.value !== undefined && (value.easing || value.progress)) {
                if (typeof value.easing === 'string') {
                    easing = cc.easing[value.easing];
                    !easing && cc.warnID(1031, value.easing);
                }
                else {
                    easing = value.easing;
                }
                progress = value.progress;
                value = value.value;
            }

            let isNumber = typeof value === 'number';
            if (!isNumber && (!value.lerp || (relative && !value.add && !value.mul) || !value.clone)) {
                cc.warn(`Can not animate ${name} property, because it do not have [lerp, (add|mul), clone] function.`);
                continue;
            }

            let prop = Object.create(null);
            prop.value = value;
            prop.easing = easing;
            prop.progress = progress;
            this._props[name] = prop;
        }

        this._originProps = props;
        this.initWithDuration(duration);
    },

    clone () {
        var action = new TweenAction(this._duration, this._originProps, this._opts);
        this._cloneDecoration(action);
        return action;
    },

    startWithTarget (target) {
        cc.ActionInterval.prototype.startWithTarget.call(this, target);

        let relative = !!this._opts.relative;
        let props = this._props;
        for (let name in props) {
            let value = target[name];
            let prop = props[name];

            if (typeof value === 'number') {
                prop.start = value;
                prop.current = value;
                prop.end = relative ? value + prop.value : prop.value;
            }
            else {
                prop.start = value.clone();
                prop.current = value.clone();
                prop.end = relative ? (value.add || value.mul).call(value, prop.value) : prop.value;
            }
        }
    },

    update (t) {
        let opts = this._opts;
        let easingTime = t;
        if (opts.easing) easingTime = opts.easing(t);

        let target = this.target;
        if (!target) return;

        let props = this._props;
        let progress = this._opts.progress;
        for (let name in props) {
            let prop = props[name];
            let time = prop.easing ? prop.easing(t) : easingTime;
            let current = prop.current = (prop.progress || progress)(prop.start, prop.end, prop.current, time);
            target[name] = current;
        }
    },

    progress (start, end, current, t) {
        if (typeof start === 'number') {
            current = start + (end - start) * t;
        }
        else {
            start.lerp(end, t, current);
        }
        return current;
    }
});

let SetAction = cc.Class({
    name: 'cc.SetAction',
    extends: cc.ActionInstant,

    ctor (props) {
        this._props = {};
        props !== undefined && this.init(props);
    },

    init (props) {
        for (let name in props) {
            this._props[name] = props[name];
        }
        return true;
    },

    update () {
        let props = this._props;
        let target = this.target;
        for (let name in props) {
            target[name] = props[name];
        }
    },

    clone () {
        var action = new SetAction();
        action.init(this._props);
        return action;
    }
});



/**
 * !#en
 * Tween provide a simple and flexible way to create action. Tween's api is more flexible than `cc.Action`:
 *  - Support creating an action sequence in chained api.
 *  - Support animate any objects' any properties, not limited to node's properties. By contrast, `cc.Action` needs to create a new action class to support new node property.
 *  - Support working with `cc.Action`.
 *  - Support easing and progress function.
 * !#zh
 * Tween ????????????????????????????????????????????? action???????????? Cocos ????????? `cc.Action`???`cc.Tween` ???????????????????????????????????????
 *  - ?????????????????????????????????????????????????????????
 *  - ?????????????????????????????????????????????????????????????????????????????????????????? `cc.Action` ????????????????????????????????????????????????????????? action ?????????
 *  - ????????? `cc.Action` ?????????
 *  - ???????????? {{#crossLink "Easing"}}{{/crossLink}} ?????? progress ?????????
 * @class Tween
 * @example
 * cc.tween(node)
 *   .to(1, {scale: 2, position: cc.v3(100, 100, 100)})
 *   .call(() => { console.log('This is a callback'); })
 *   .by(1, {scale: 3, position: cc.v3(200, 200, 200)}, {easing: 'sineOutIn'})
 *   .start(cc.find('Canvas/cocos'));
 * @typescript Tween<T = any>
 */
function Tween (target) {
    this._actions = [];
    this._finalAction = null;
    this._target = target;
    this._tag = cc.Action.TAG_INVALID;
}

/**
 * @method constructor
 * @param {Object} [target]
 */

/**
 * !#en Stop all tweens
 * !#zh ??????????????????
 * @method stopAll
 * @static
 */
Tween.stopAll = function () {
    cc.director.getActionManager().removeAllActions();
}
/**
 * !#en Stop all tweens by tag
 * !#zh ?????????????????????????????????
 * @method stopAllByTag
 * @static
 * @param {number} tag
 */
Tween.stopAllByTag = function (tag) {
    cc.director.getActionManager().removeActionByTag(tag);
}
/**
 * !#en Stop all tweens by target
 * !#zh ?????????????????????????????????
 * @method stopAllByTarget
 * @static
 * @param {Object} target
 */
Tween.stopAllByTarget = function (target) {
    cc.director.getActionManager().removeAllActionsFromTarget(target);
}

/**
 * !#en
 * Insert an action or tween to this sequence
 * !#zh
 * ???????????? action ?????? tween ????????????
 * @method then 
 * @param {Action|Tween} other
 * @return {Tween}
 * @typescript then(other: Action|Tween<T>): Tween<T>
 */
Tween.prototype.then = function (other) {
    if (other instanceof cc.Action) {
        this._actions.push(other.clone());
    }
    else {
        this._actions.push(other._union());
    }
    return this;
};


/**
 * !#en
 * Set tween target
 * !#zh
 * ?????? tween ??? target
 * @method target
 * @param {Object} target
 * @return {Tween}
 * @typescript target(target: any): Tween<T>
 */
Tween.prototype.target = function (target) {
    this._target = target;
    return this;
};

/**
 * !#en
 * Start this tween
 * !#zh
 * ???????????? tween
 * @method start
 * @return {Tween}
 * @typescript start(): Tween<T>
 */
Tween.prototype.start = function () {
    let target = this._target;
    if (!target) {
        cc.warn('Please set target to tween first');
        return this;
    }
    if (target instanceof cc.Object && !target.isValid) {
        return;
    }

    if (this._finalAction) {
        cc.director.getActionManager().removeAction(this._finalAction);
    }
    this._finalAction = this._union();

    if (target._id === undefined) {
        target._id = ++_tweenID;
    }

    this._finalAction.setTag(this._tag);
    cc.director.getActionManager().addAction(this._finalAction, target, false);
    return this;
};

/**
 * !#en
 * Stop this tween
 * !#zh
 * ???????????? tween
 * @method stop
 * @return {Tween}
 * @typescript stop(): Tween<T>
 */
Tween.prototype.stop = function () {
    if (this._finalAction) {
        cc.director.getActionManager().removeAction(this._finalAction);
    }
    return this;
};


/**
 * !#en Sets tween tag
 * !#zh ?????????????????????
 * @method tag
 * @param {number} tag
 * @return {Tween}
 * @typescript tag(tag: number): Tween<T>
 */
Tween.prototype.tag = function (tag) {
    this._tag = tag;
    return this;
};


/**
 * !#en
 * Clone a tween
 * !#zh
 * ???????????? tween
 * @method clone
 * @param {Object} [target]
 * @return {Tween}
 * @typescript clone(target?: any): Tween<T>
 */
Tween.prototype.clone = function (target) {
    let action = this._union();
    return cc.tween(target).then(action.clone());
};

/**
 * !#en
 * Integrate all previous actions to an action.
 * !#zh
 * ?????????????????? action ??????????????? action???
 * @method union
 * @return {Tween}
 * @typescritp union(): Tween<T>
 */
Tween.prototype.union = function () {
    let action = this._union();
    this._actions.length = 0;
    this._actions.push(action);
    return this;
};

Tween.prototype._union = function () {
    let actions = this._actions;

    if (actions.length === 1) {
        actions = actions[0];
    }
    else {
        actions = cc.sequence(actions);
    }

    return actions;
};

Object.assign(Tween.prototype, {
    /**
     * !#en Sets target's position property according to the bezier curve.
     * !#zh ???????????????????????????????????? position ?????????
     * @method bezierTo
     * @param {number} duration
     * @param {cc.Vec2} c1
     * @param {cc.Vec2} c2
     * @param {cc.Vec2} to
     * @return {Tween}
     * @typescript bezierTo(duration: number, c1: Vec2, c2: Vec2, to: Vec2): Tween<T>
     */
    bezierTo (duration, c1, c2, to, opts) {
        let c0x = c1.x, c0y = c1.y,
            c1x = c2.x, c1y = c2.y;
        opts = opts || Object.create(null);
        opts.progress = function (start, end, current, t) {
            current.x = bezier(start.x, c0x, c1x, end.x, t);
            current.y = bezier(start.y, c0y, c1y, end.y, t);
            return current;
        }
        return this.to(duration, { position: to }, opts);
    },

    /**
     * !#en Sets target's position property according to the bezier curve.
     * !#zh ???????????????????????????????????? position ?????????
     * @method bezierBy
     * @param {number} duration
     * @param {cc.Vec2} c1
     * @param {cc.Vec2} c2
     * @param {cc.Vec2} to
     * @return {Tween}
     * @typescript bezierBy(duration: number, c1: Vec2, c2: Vec2, to: Vec2): Tween<T>
     */
    bezierBy (duration, c1, c2, to, opts) {
        let c0x = c1.x, c0y = c1.y,
            c1x = c2.x, c1y = c2.y;
        opts = opts || Object.create(null);
        opts.progress = function (start, end, current, t) {
            let sx = start.x, sy = start.y;
            current.x = bezier(sx, c0x + sx, c1x + sx, end.x, t);
            current.y = bezier(sy, c0y + sy, c1y + sy, end.y, t);
            return current;
        }
        return this.by(duration, { position: to }, opts);
    },

    /**
     * !#en Flips target's scaleX
     * !#zh ??????????????? scaleX ??????
     * @method flipX
     * @return {Tween}
     * @typescript flipX(): Tween<T>
     */
    flipX () {
        return this.call(() => { this._target.scaleX *= -1; }, this);
        
    },
    /**
     * !#en Flips target's scaleY
     * !#zh ??????????????? scaleY ??????
     * @method flipY
     * @return {Tween}
     * @typescript flipY(): Tween<T>
     */
    flipY () {
        return this.call(() => { this._target.scaleY *= -1; }, this);
    },

    /**
     * !#en Blinks target by set target's opacity property
     * !#zh ????????????????????? opacity ????????????????????????
     * @method blink
     * @param {number} duration
     * @param {number} times
     * @param {Object} [opts]
     * @param {Function} [opts.progress]
     * @param {Function|String} [opts.easing]
     * @return {Tween}
     * @typescript blink(duration: number, times: number, opts?: {progress?: Function; easing?: Function|string; }): Tween<T>
     */
    blink (duration, times, opts) {
        var slice = 1.0 / times;
        opts = opts || Object.create(null);
        opts.progress = function (start, end, current, t) {
            if (t >= 1) {
                return start;
            }
            else {
                var m = t % slice;
                return (m > (slice / 2)) ? 255 : 0;
            }
        };
        return this.to(duration, { opacity: 1 }, opts);
    },
})

let tmp_args = [];

function wrapAction (action) {
    return function () {
        tmp_args.length = 0;
        for (let l = arguments.length, i = 0; i < l; i++) {
            let arg = tmp_args[i] = arguments[i];
            if (arg instanceof Tween) {
                tmp_args[i] = arg._union();
            }
        }

        return action.apply(this, tmp_args);
    };
}

let actions = {
    /**
     * !#en
     * Add an action which calculate with absolute value
     * !#zh
     * ????????????????????????????????????????????? action
     * @method to
     * @param {Number} duration
     * @param {Object} props - {scale: 2, position: cc.v3(100, 100, 100)}
     * @param {Object} [opts]
     * @param {Function} [opts.progress]
     * @param {Function|String} [opts.easing]
     * @return {Tween}
     * @typescript
     * to <OPTS extends Partial<{progress: Function, easing: Function|String}>> (duration: number, props: ConstructorType<T>, opts?: OPTS) : Tween<T>
     */
    to (duration, props, opts) {
        opts = opts || Object.create(null);
        opts.relative = false;
        return new TweenAction(duration, props, opts);
    },

    /**
     * !#en
     * Add an action which calculate with relative value
     * !#zh
     * ????????????????????????????????????????????? action
     * @method by
     * @param {Number} duration
     * @param {Object} props - {scale: 2, position: cc.v3(100, 100, 100)}
     * @param {Object} [opts]
     * @param {Function} [opts.progress]
     * @param {Function|String} [opts.easing]
     * @return {Tween}
     * @typescript
     * by <OPTS extends Partial<{progress: Function, easing: Function|String}>> (duration: number, props: ConstructorType<T>, opts?: OPTS) : Tween<T>
     */
    by (duration, props, opts) {
        opts = opts || Object.create(null);
        opts.relative = true;
        return new TweenAction(duration, props, opts);
    },

    /**
     * !#en
     * Directly set target properties
     * !#zh
     * ???????????? target ?????????
     * @method set
     * @param {Object} props
     * @return {Tween}
     * @typescript
     * set (props: ConstructorType<T>) : Tween<T>
     */
    set (props) {
        return new SetAction(props);
    },

    /**
     * !#en
     * Add an delay action
     * !#zh
     * ?????????????????? action
     * @method delay
     * @param {Number} duration
     * @return {Tween}
     * @typescript delay(duration: number): Tween<T>
     */
    delay: cc.delayTime,
    /**
     * !#en
     * Add an callback action
     * !#zh
     * ?????????????????? action
     * @method call
     * @param {Function} callback
     * @return {Tween}
     * @typescript call(callback: Function): Tween<T>
     */
    call: cc.callFunc,
    /**
     * !#en
     * Add an hide action
     * !#zh
     * ?????????????????? action
     * @method hide
     * @return {Tween}
     * @typescript hide(): Tween<T>
     */
    hide: cc.hide,
    /**
     * !#en
     * Add an show action
     * !#zh
     * ?????????????????? action
     * @method show
     * @return {Tween}
     * @typescript show(): Tween<T>
     */
    show: cc.show,
    /**
     * !#en
     * Add an removeSelf action
     * !#zh
     * ???????????????????????? action
     * @method removeSelf
     * @return {Tween}
     * @typescript removeSelf(): Tween<T>
     */
    removeSelf: cc.removeSelf,
    /**
     * !#en
     * Add an sequence action
     * !#zh
     * ?????????????????? action
     * @method sequence
     * @param {Action|Tween} action
     * @param {Action|Tween} ...actions
     * @return {Tween}
     * @typescript sequence(action: Action|Tween<T>, ...actions: (Action|Tween<T>)[]): Tween<T>
     */
    sequence: wrapAction(cc.sequence),
    /**
     * !#en
     * Add an parallel action
     * !#zh
     * ?????????????????? action
     * @method parallel
     * @param {Action|Tween} action
     * @param {Action|Tween} ...actions
     * @return {Tween}
     * @typescript parallel(action: Action|Tween<T>, ...actions: (Action|Tween<T>)[]): Tween<T>
     */
    parallel: wrapAction(cc.spawn)
};

// these action will use previous action as their parameters
let previousAsInputActions = {
    /**
     * !#en
     * Add an repeat action. This action will integrate before actions to a sequence action as their parameters.
     * !#zh
     * ?????????????????? action????????? action ??????????????????????????????????????????
     * @method repeat
     * @param {Number} repeatTimes
     * @param {Action | Tween} [action]
     * @return {Tween}
     * @typescript repeat(repeatTimes: number, action?: Action|Tween<T>): Tween<T>
     */
    repeat: cc.repeat,
    /**
     * !#en
     * Add an repeat forever action. This action will integrate before actions to a sequence action as their parameters.
     * !#zh
     * ???????????????????????? action????????? action ??????????????????????????????????????????
     * @method repeatForever
     * @param {Action | Tween} [action]
     * @return {Tween}
     * @typescript repeatForever(action?: Action|Tween<T>): Tween<T>
     */
    repeatForever: function (action) {
        // TODO: fixed with cc.repeatForever
        return cc.repeat(action, 10e8);
    },
    /**
     * !#en
     * Add an reverse time action. This action will integrate before actions to a sequence action as their parameters.
     * !#zh
     * ???????????????????????? action????????? action ??????????????????????????????????????????
     * @method reverseTime
     * @param {Action | Tween} [action]
     * @return {Tween}
     * @typescript reverseTime(action?: Action|Tween<T>): Tween<T>
     */
    reverseTime: cc.reverseTime,
};


let keys = Object.keys(actions);
for (let i = 0; i < keys.length; i++) {
    let key = keys[i];
    Tween.prototype[key] = function () {
        let action = actions[key].apply(this, arguments);
        this._actions.push(action);
        return this;
    };
}

keys = Object.keys(previousAsInputActions);
for (let i = 0; i < keys.length; i++) {
    let key = keys[i];
    Tween.prototype[key] = function () {

        let actions = this._actions;
        let action = arguments[arguments.length - 1];
        let length = arguments.length - 1;

        if (action instanceof cc.Tween) {
            action = action._union();
        }
        else if (!(action instanceof cc.Action)) {
            action = actions[actions.length - 1];
            actions.length -= 1;
            length += 1;
        }

        let args = [action];
        for (let i = 0; i < length; i++) {
            args.push(arguments[i]);
        }

        action = previousAsInputActions[key].apply(this, args);
        actions.push(action);

        return this;
    };
}

/**
 * @module cc
 */

/**
 * @method tween
 * @param {Object} [target] - the target to animate
 * @return {Tween}
 * @typescript
 * tween<T> (target?: T) : Tween<T>
 */
cc.tween = function (target) {
    return new Tween(target);
};

cc.Tween = Tween;
  