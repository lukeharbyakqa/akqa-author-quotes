
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function null_to_empty(value) {
        return value == null ? '' : value;
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * Creates an event dispatcher that can be used to dispatch [component events](/docs#template-syntax-component-directives-on-eventname).
     * Event dispatchers are functions that can take two arguments: `name` and `detail`.
     *
     * Component events created with `createEventDispatcher` create a
     * [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent).
     * These events do not [bubble](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events#Event_bubbling_and_capture).
     * The `detail` argument corresponds to the [CustomEvent.detail](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/detail)
     * property and can contain any type of data.
     *
     * https://svelte.dev/docs#run-time-svelte-createeventdispatcher
     */
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail, { cancelable = false } = {}) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail, { cancelable });
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
                return !event.defaultPrevented;
            }
            return true;
        };
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            // @ts-ignore
            callbacks.slice().forEach(fn => fn.call(this, event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }
    function outro_and_destroy_block(block, lookup) {
        transition_out(block, 1, 1, () => {
            lookup.delete(block.key);
        });
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        const updates = [];
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                // defer updates until all the DOM shuffling is done
                updates.push(() => block.p(child_ctx, dirty));
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        run_all(updates);
        return new_blocks;
    }
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error('Cannot have duplicate keys in a keyed each');
            }
            keys.add(key);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.2' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\UI\TextInput.svelte generated by Svelte v3.59.2 */

    const file$3 = "src\\UI\\TextInput.svelte";

    function create_fragment$3(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			input = element("input");
    			attr_dev(input, "type", "text");
    			attr_dev(input, "placeholder", /*placeholder*/ ctx[1]);
    			attr_dev(input, "class", "svelte-1swfn9h");
    			add_location(input, file$3, 13, 0, 201);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*name*/ ctx[0]);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "keypress", /*keypress_handler*/ ctx[2], false, false, false, false),
    					listen_dev(input, "input", /*input_input_handler*/ ctx[5]),
    					listen_dev(input, "focus", /*focus_handler*/ ctx[3], false, false, false, false),
    					listen_dev(input, "blur", /*blur_handler*/ ctx[4], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*placeholder*/ 2) {
    				attr_dev(input, "placeholder", /*placeholder*/ ctx[1]);
    			}

    			if (dirty & /*name*/ 1 && input.value !== /*name*/ ctx[0]) {
    				set_input_value(input, /*name*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('TextInput', slots, []);
    	let { name = "" } = $$props;
    	let { placeholder = "" } = $$props;
    	const writable_props = ['name', 'placeholder'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<TextInput> was created with unknown prop '${key}'`);
    	});

    	function keypress_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	function focus_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	function blur_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	function input_input_handler() {
    		name = this.value;
    		$$invalidate(0, name);
    	}

    	$$self.$$set = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    		if ('placeholder' in $$props) $$invalidate(1, placeholder = $$props.placeholder);
    	};

    	$$self.$capture_state = () => ({ name, placeholder });

    	$$self.$inject_state = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    		if ('placeholder' in $$props) $$invalidate(1, placeholder = $$props.placeholder);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		name,
    		placeholder,
    		keypress_handler,
    		focus_handler,
    		blur_handler,
    		input_input_handler
    	];
    }

    class TextInput extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { name: 0, placeholder: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TextInput",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get name() {
    		throw new Error("<TextInput>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<TextInput>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get placeholder() {
    		throw new Error("<TextInput>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set placeholder(value) {
    		throw new Error("<TextInput>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\UI\Button.svelte generated by Svelte v3.59.2 */

    const file$2 = "src\\UI\\Button.svelte";

    function create_fragment$2(ctx) {
    	let button;
    	let t;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text(/*name*/ ctx[0]);
    			attr_dev(button, "type", "submit");
    			button.disabled = /*disabled*/ ctx[1];
    			attr_dev(button, "class", "svelte-1t630ps");
    			add_location(button, file$2, 15, 0, 257);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[2], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*name*/ 1) set_data_dev(t, /*name*/ ctx[0]);

    			if (dirty & /*disabled*/ 2) {
    				prop_dev(button, "disabled", /*disabled*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Button', slots, []);
    	let { name = "" } = $$props;
    	let { disabled = false } = $$props;
    	const writable_props = ['name', 'disabled'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Button> was created with unknown prop '${key}'`);
    	});

    	function click_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	$$self.$$set = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    		if ('disabled' in $$props) $$invalidate(1, disabled = $$props.disabled);
    	};

    	$$self.$capture_state = () => ({ name, disabled });

    	$$self.$inject_state = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    		if ('disabled' in $$props) $$invalidate(1, disabled = $$props.disabled);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [name, disabled, click_handler];
    }

    class Button extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { name: 0, disabled: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Button",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get name() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get disabled() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set disabled(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var img = "data:image/svg+xml,%3c%3fxml version='1.0' encoding='utf-8'%3f%3e%3c!-- Uploaded to: SVG Repo%2c www.svgrepo.com%2c Generator: SVG Repo Mixer Tools --%3e%3csvg width='800px' height='800px' viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3e %3cpolygon fill='var(--ci-primary-color%2c black)' points='400 464 48 464 48 104 240 104 240 72 16 72 16 496 432 496 432 272 400 272 400 464' class='ci-primary'/%3e %3cpolygon fill='var(--ci-primary-color%2c black)' points='304 16 304 48 441.373 48 188.687 300.687 211.313 323.313 464 70.627 464 208 496 208 496 16 304 16' class='ci-primary'/%3e%3c/svg%3e";

    /* src\UI\Results.svelte generated by Svelte v3.59.2 */

    const { console: console_1 } = globals;
    const file$1 = "src\\UI\\Results.svelte";

    // (61:8) {:else}
    function create_else_block(ctx) {
    	let a;
    	let t0;
    	let t1_value = (/*authorCount*/ ctx[3] === 1 ? `` : `s`) + "";
    	let t1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			a = element("a");
    			t0 = text("quote");
    			t1 = text(t1_value);
    			attr_dev(a, "href", "/");
    			attr_dev(a, "class", "svelte-1xdujt0");
    			add_location(a, file$1, 61, 12, 1139);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, t0);
    			append_dev(a, t1);

    			if (!mounted) {
    				dispose = listen_dev(a, "click", /*click_handler*/ ctx[5], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*authorCount*/ 8 && t1_value !== (t1_value = (/*authorCount*/ ctx[3] === 1 ? `` : `s`) + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(61:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (59:8) {#if authorCount === 0}
    function create_if_block$1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("quotes");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(59:8) {#if authorCount === 0}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let li;
    	let p0;
    	let t0;
    	let t1;
    	let p1;
    	let t2;
    	let t3;
    	let p2;
    	let t4;
    	let t5;
    	let t6;
    	let a;
    	let t7;
    	let img$1;
    	let img_src_value;

    	function select_block_type(ctx, dirty) {
    		if (/*authorCount*/ ctx[3] === 0) return create_if_block$1;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			li = element("li");
    			p0 = element("p");
    			t0 = text(/*authorName*/ ctx[0]);
    			t1 = space();
    			p1 = element("p");
    			t2 = text(/*authorDescription*/ ctx[1]);
    			t3 = space();
    			p2 = element("p");
    			t4 = text(/*authorCount*/ ctx[3]);
    			t5 = space();
    			if_block.c();
    			t6 = space();
    			a = element("a");
    			t7 = text("Wikipedia entry \r\n        ");
    			img$1 = element("img");
    			attr_dev(p0, "class", "svelte-1xdujt0");
    			add_location(p0, file$1, 54, 4, 971);
    			attr_dev(p1, "class", "svelte-1xdujt0");
    			add_location(p1, file$1, 55, 4, 996);
    			attr_dev(p2, "class", "svelte-1xdujt0");
    			add_location(p2, file$1, 56, 4, 1028);
    			if (!src_url_equal(img$1.src, img_src_value = img)) attr_dev(img$1, "src", img_src_value);
    			attr_dev(img$1, "alt", "");
    			attr_dev(img$1, "class", "svelte-1xdujt0");
    			add_location(img$1, file$1, 66, 8, 1348);
    			attr_dev(a, "href", /*authorLink*/ ctx[2]);
    			attr_dev(a, "target", "_blank");
    			attr_dev(a, "class", "wiki svelte-1xdujt0");
    			add_location(a, file$1, 64, 4, 1262);
    			attr_dev(li, "class", "svelte-1xdujt0");
    			add_location(li, file$1, 53, 0, 961);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, p0);
    			append_dev(p0, t0);
    			append_dev(li, t1);
    			append_dev(li, p1);
    			append_dev(p1, t2);
    			append_dev(li, t3);
    			append_dev(li, p2);
    			append_dev(p2, t4);
    			append_dev(p2, t5);
    			if_block.m(p2, null);
    			append_dev(li, t6);
    			append_dev(li, a);
    			append_dev(a, t7);
    			append_dev(a, img$1);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*authorName*/ 1) set_data_dev(t0, /*authorName*/ ctx[0]);
    			if (dirty & /*authorDescription*/ 2) set_data_dev(t2, /*authorDescription*/ ctx[1]);
    			if (dirty & /*authorCount*/ 8) set_data_dev(t4, /*authorCount*/ ctx[3]);

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(p2, null);
    				}
    			}

    			if (dirty & /*authorLink*/ 4) {
    				attr_dev(a, "href", /*authorLink*/ ctx[2]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Results', slots, []);
    	let { authorName } = $$props;
    	let { authorDescription } = $$props;
    	let { authorLink } = $$props;
    	let { authorCount } = $$props;
    	const dispatch = createEventDispatcher();

    	function authorEvent(event) {
    		event.preventDefault();
    		dispatch('authorEvent');
    		console.log('authorEvent', event.type);
    	}

    	$$self.$$.on_mount.push(function () {
    		if (authorName === undefined && !('authorName' in $$props || $$self.$$.bound[$$self.$$.props['authorName']])) {
    			console_1.warn("<Results> was created without expected prop 'authorName'");
    		}

    		if (authorDescription === undefined && !('authorDescription' in $$props || $$self.$$.bound[$$self.$$.props['authorDescription']])) {
    			console_1.warn("<Results> was created without expected prop 'authorDescription'");
    		}

    		if (authorLink === undefined && !('authorLink' in $$props || $$self.$$.bound[$$self.$$.props['authorLink']])) {
    			console_1.warn("<Results> was created without expected prop 'authorLink'");
    		}

    		if (authorCount === undefined && !('authorCount' in $$props || $$self.$$.bound[$$self.$$.props['authorCount']])) {
    			console_1.warn("<Results> was created without expected prop 'authorCount'");
    		}
    	});

    	const writable_props = ['authorName', 'authorDescription', 'authorLink', 'authorCount'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<Results> was created with unknown prop '${key}'`);
    	});

    	const click_handler = event => authorEvent(event);

    	$$self.$$set = $$props => {
    		if ('authorName' in $$props) $$invalidate(0, authorName = $$props.authorName);
    		if ('authorDescription' in $$props) $$invalidate(1, authorDescription = $$props.authorDescription);
    		if ('authorLink' in $$props) $$invalidate(2, authorLink = $$props.authorLink);
    		if ('authorCount' in $$props) $$invalidate(3, authorCount = $$props.authorCount);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		externalLink: img,
    		authorName,
    		authorDescription,
    		authorLink,
    		authorCount,
    		dispatch,
    		authorEvent
    	});

    	$$self.$inject_state = $$props => {
    		if ('authorName' in $$props) $$invalidate(0, authorName = $$props.authorName);
    		if ('authorDescription' in $$props) $$invalidate(1, authorDescription = $$props.authorDescription);
    		if ('authorLink' in $$props) $$invalidate(2, authorLink = $$props.authorLink);
    		if ('authorCount' in $$props) $$invalidate(3, authorCount = $$props.authorCount);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		authorName,
    		authorDescription,
    		authorLink,
    		authorCount,
    		authorEvent,
    		click_handler
    	];
    }

    class Results extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
    			authorName: 0,
    			authorDescription: 1,
    			authorLink: 2,
    			authorCount: 3
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Results",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get authorName() {
    		throw new Error("<Results>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set authorName(value) {
    		throw new Error("<Results>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get authorDescription() {
    		throw new Error("<Results>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set authorDescription(value) {
    		throw new Error("<Results>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get authorLink() {
    		throw new Error("<Results>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set authorLink(value) {
    		throw new Error("<Results>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get authorCount() {
    		throw new Error("<Results>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set authorCount(value) {
    		throw new Error("<Results>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\App.svelte generated by Svelte v3.59.2 */
    const file = "src\\App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[13] = list[i];
    	return child_ctx;
    }

    // (129:8) {#if results.length}
    function create_if_block_1(ctx) {
    	let li0;
    	let button;
    	let t1;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t2;
    	let li1;
    	let t3;
    	let span;
    	let t4_value = /*results*/ ctx[0].length + "";
    	let t4;
    	let t5;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value = /*results*/ ctx[0];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*item*/ ctx[13]._id;
    	validate_each_keys(ctx, each_value, get_each_context, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			li0 = element("li");
    			button = element("button");
    			button.textContent = "x";
    			t1 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t2 = space();
    			li1 = element("li");
    			t3 = text("Total of ");
    			span = element("span");
    			t4 = text(t4_value);
    			t5 = text(" results");
    			attr_dev(button, "title", "Reset");
    			attr_dev(button, "class", "svelte-5zmb62");
    			add_location(button, file, 129, 16, 2948);
    			add_location(li0, file, 129, 12, 2944);
    			attr_dev(span, "class", "results-total svelte-5zmb62");
    			add_location(span, file, 138, 25, 3338);
    			add_location(li1, file, 138, 12, 3325);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li0, anchor);
    			append_dev(li0, button);
    			insert_dev(target, t1, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(target, anchor);
    				}
    			}

    			insert_dev(target, t2, anchor);
    			insert_dev(target, li1, anchor);
    			append_dev(li1, t3);
    			append_dev(li1, span);
    			append_dev(span, t4);
    			append_dev(li1, t5);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*handleReset*/ ctx[5], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*results*/ 1) {
    				each_value = /*results*/ ctx[0];
    				validate_each_argument(each_value);
    				group_outros();
    				validate_each_keys(ctx, each_value, get_each_context, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, t2.parentNode, outro_and_destroy_block, create_each_block, t2, get_each_context);
    				check_outros();
    			}

    			if ((!current || dirty & /*results*/ 1) && t4_value !== (t4_value = /*results*/ ctx[0].length + "")) set_data_dev(t4, t4_value);
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li0);
    			if (detaching) detach_dev(t1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d(detaching);
    			}

    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(li1);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(129:8) {#if results.length}",
    		ctx
    	});

    	return block;
    }

    // (131:12) {#each results as item (item._id)}
    function create_each_block(key_1, ctx) {
    	let first;
    	let results_1;
    	let current;

    	results_1 = new Results({
    			props: {
    				authorName: /*item*/ ctx[13].name,
    				authorDescription: /*item*/ ctx[13].description,
    				authorLink: /*item*/ ctx[13].link,
    				authorCount: /*item*/ ctx[13].quoteCount
    			},
    			$$inline: true
    		});

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			create_component(results_1.$$.fragment);
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);
    			mount_component(results_1, target, anchor);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			const results_1_changes = {};
    			if (dirty & /*results*/ 1) results_1_changes.authorName = /*item*/ ctx[13].name;
    			if (dirty & /*results*/ 1) results_1_changes.authorDescription = /*item*/ ctx[13].description;
    			if (dirty & /*results*/ 1) results_1_changes.authorLink = /*item*/ ctx[13].link;
    			if (dirty & /*results*/ 1) results_1_changes.authorCount = /*item*/ ctx[13].quoteCount;
    			results_1.$set(results_1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(results_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(results_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			destroy_component(results_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(131:12) {#each results as item (item._id)}",
    		ctx
    	});

    	return block;
    }

    // (142:4) {#if value && success && !results.length}
    function create_if_block(ctx) {
    	let p;
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t0 = text("Sorry no results for ");
    			t1 = text(/*value*/ ctx[1]);
    			add_location(p, file, 142, 8, 3481);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t0);
    			append_dev(p, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*value*/ 2) set_data_dev(t1, /*value*/ ctx[1]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(142:4) {#if value && success && !results.length}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div1;
    	let h2;
    	let t1;
    	let div0;
    	let p;
    	let t3;
    	let textinput;
    	let t4;
    	let button;
    	let t5;
    	let ul;
    	let ul_class_value;
    	let t6;
    	let current;

    	textinput = new TextInput({
    			props: {
    				name: /*value*/ ctx[1],
    				placeholder: /*placeholder*/ ctx[3]
    			},
    			$$inline: true
    		});

    	textinput.$on("keypress", /*keypress_handler*/ ctx[8]);
    	textinput.$on("focus", /*focus_handler*/ ctx[9]);
    	textinput.$on("blur", /*blur_handler*/ ctx[10]);

    	button = new Button({
    			props: {
    				name: 'Submit',
    				disabled: /*value*/ ctx[1] && /*value*/ ctx[1].length >= 2
    				? false
    				: true
    			},
    			$$inline: true
    		});

    	let if_block0 = /*results*/ ctx[0].length && create_if_block_1(ctx);
    	let if_block1 = /*value*/ ctx[1] && /*success*/ ctx[2] && !/*results*/ ctx[0].length && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			h2 = element("h2");
    			h2.textContent = "Search for quotes by authors";
    			t1 = space();
    			div0 = element("div");
    			p = element("p");
    			p.textContent = "Enter an author's name";
    			t3 = space();
    			create_component(textinput.$$.fragment);
    			t4 = space();
    			create_component(button.$$.fragment);
    			t5 = space();
    			ul = element("ul");
    			if (if_block0) if_block0.c();
    			t6 = space();
    			if (if_block1) if_block1.c();
    			attr_dev(h2, "class", "svelte-5zmb62");
    			add_location(h2, file, 112, 4, 2359);
    			add_location(p, file, 114, 8, 2438);
    			attr_dev(div0, "class", "inner__wrapper svelte-5zmb62");
    			add_location(div0, file, 113, 4, 2401);
    			attr_dev(ul, "class", ul_class_value = "" + (null_to_empty(/*results*/ ctx[0].length ? `fade-in` : ``) + " svelte-5zmb62"));
    			add_location(ul, file, 127, 4, 2858);
    			attr_dev(div1, "class", "inner svelte-5zmb62");
    			add_location(div1, file, 111, 0, 2335);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, h2);
    			append_dev(div1, t1);
    			append_dev(div1, div0);
    			append_dev(div0, p);
    			append_dev(div0, t3);
    			mount_component(textinput, div0, null);
    			append_dev(div0, t4);
    			mount_component(button, div0, null);
    			append_dev(div1, t5);
    			append_dev(div1, ul);
    			if (if_block0) if_block0.m(ul, null);
    			append_dev(div1, t6);
    			if (if_block1) if_block1.m(div1, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const textinput_changes = {};
    			if (dirty & /*value*/ 2) textinput_changes.name = /*value*/ ctx[1];
    			if (dirty & /*placeholder*/ 8) textinput_changes.placeholder = /*placeholder*/ ctx[3];
    			textinput.$set(textinput_changes);
    			const button_changes = {};

    			if (dirty & /*value*/ 2) button_changes.disabled = /*value*/ ctx[1] && /*value*/ ctx[1].length >= 2
    			? false
    			: true;

    			button.$set(button_changes);

    			if (/*results*/ ctx[0].length) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty & /*results*/ 1) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_1(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(ul, null);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (!current || dirty & /*results*/ 1 && ul_class_value !== (ul_class_value = "" + (null_to_empty(/*results*/ ctx[0].length ? `fade-in` : ``) + " svelte-5zmb62"))) {
    				attr_dev(ul, "class", ul_class_value);
    			}

    			if (/*value*/ ctx[1] && /*success*/ ctx[2] && !/*results*/ ctx[0].length) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block(ctx);
    					if_block1.c();
    					if_block1.m(div1, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(textinput.$$.fragment, local);
    			transition_in(button.$$.fragment, local);
    			transition_in(if_block0);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(textinput.$$.fragment, local);
    			transition_out(button.$$.fragment, local);
    			transition_out(if_block0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(textinput);
    			destroy_component(button);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);

    	const isProduction = ({
    		"env": {
    			"isProd": false,
    			"PUBLIC_API_URL": "https://api.quotable.io"
    		}
    	})["env"]["isProd"];

    	const apiURL = ({
    			"env": {
    				"isProd": false,
    				"PUBLIC_API_URL": "https://api.quotable.io"
    			}
    		})["env"]["PUBLIC_API_URL"];

    	let results = [];
    	let value;
    	let success = false;
    	let placeholder = "For example 'Emily Dickinson'. Then hit enter";

    	let handleSearch = event => {
    		$$invalidate(2, success = false);
    		const url = `${apiURL}/search/authors?query=`;
    		$$invalidate(1, value = event.target.value);

    		if (value.length < 3) {
    			return;
    		} else if (event.which === 13) {
    			fetch(`${url}${value}`).then(data => {
    				return data.json();
    			}).then(data => {
    				$$invalidate(2, success = true);
    				$$invalidate(0, results = data.results);
    			});
    		}
    	};

    	let handleReset = event => {
    		event.target.closest('ul').replaceChildren();
    		$$invalidate(0, results = []);
    		$$invalidate(2, success = false);
    		$$invalidate(1, value = "");
    	};

    	let handleFocus = () => {
    		$$invalidate(3, placeholder = "");
    	};

    	let handleBlur = () => {
    		$$invalidate(3, placeholder = "For example 'Emily Dickinson'. Then hit enter");
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const keypress_handler = event => handleSearch(event);
    	const focus_handler = event => handleFocus(event);
    	const blur_handler = event => handleBlur(event);

    	$$self.$capture_state = () => ({
    		TextInput,
    		Button,
    		Results,
    		isProduction,
    		apiURL,
    		results,
    		value,
    		success,
    		placeholder,
    		handleSearch,
    		handleReset,
    		handleFocus,
    		handleBlur
    	});

    	$$self.$inject_state = $$props => {
    		if ('results' in $$props) $$invalidate(0, results = $$props.results);
    		if ('value' in $$props) $$invalidate(1, value = $$props.value);
    		if ('success' in $$props) $$invalidate(2, success = $$props.success);
    		if ('placeholder' in $$props) $$invalidate(3, placeholder = $$props.placeholder);
    		if ('handleSearch' in $$props) $$invalidate(4, handleSearch = $$props.handleSearch);
    		if ('handleReset' in $$props) $$invalidate(5, handleReset = $$props.handleReset);
    		if ('handleFocus' in $$props) $$invalidate(6, handleFocus = $$props.handleFocus);
    		if ('handleBlur' in $$props) $$invalidate(7, handleBlur = $$props.handleBlur);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		results,
    		value,
    		success,
    		placeholder,
    		handleSearch,
    		handleReset,
    		handleFocus,
    		handleBlur,
    		keypress_handler,
    		focus_handler,
    		blur_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
