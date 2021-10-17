/* oak build --web */
// module system
const __Oak_Modules = {};
let __Oak_Import_Aliases;
function __oak_modularize(name, fn) {
	__Oak_Modules[name] = fn;
}
function __oak_module_import(name) {
	if (typeof __Oak_Modules[name] === 'object') return __Oak_Modules[name];
	const module = __Oak_Modules[name] || __Oak_Modules[__Oak_Import_Aliases[name]];
	if (module) {
		return __Oak_Modules[name] = module();
	} else {
		throw new Error(`Could not import Oak module "${name}" at runtime`);
	}
}

// language primitives
let __oak_empty_assgn_trgt;
function __oak_eq(a, b) {
	a = __as_oak_string(a);
	b = __as_oak_string(b);
	if (a === __Oak_Empty || b === __Oak_Empty) return true;

	// match either null or undefined to compare correctly against undefined ?s
	// appearing in places like optional arguments
	if (a == null && b == null) return true;
	if (a === null || b === null) return false;

	if (typeof a !== typeof b) return false;
	if (__is_oak_string(a) && __is_oak_string(b)) {
		return a.valueOf() === b.valueOf();
	}
	if (typeof a === 'number' || typeof a === 'boolean' ||
		typeof a === 'function' || typeof a === 'symbol') {
		return a === b;
	}

	// deep equality check for composite values
	if (!Array.isArray(a) && typeof a !== 'object') return false;
	if (len(a) !== len(b)) return false;
	for (const key of keys(a)) {
		if (!__oak_eq(a[key], b[key])) return false;
	}
	return true;
}
function __oak_push(a, b) {
	a.push(b);
	return a;
}
function __oak_and(a, b) {
	if (typeof a === 'boolean' && typeof b === 'boolean') {
		return a && b;
	}
	if (__is_oak_string(a) && __is_oak_string(b)) {
		const max = Math.max(a.length, b.length);
		const get = (s, i) => s.valueOf().charCodeAt(i) || 0;

		let res = '';
		for (let i = 0; i < max; i ++) {
			res += String.fromCharCode(get(a, i) & get(b, i));
		}
		return res;
	}
	return a & b;
}
function __oak_or(a, b) {
	if (typeof a === 'boolean' && typeof b === 'boolean') {
		return a || b;
	}
	if (__is_oak_string(a) && __is_oak_string(b)) {
		const max = Math.max(a.length, b.length);
		const get = (s, i) => s.valueOf().charCodeAt(i) || 0;

		let res = '';
		for (let i = 0; i < max; i ++) {
			res += String.fromCharCode(get(a, i) | get(b, i));
		}
		return res;
	}
	return a | b;
}
function __oak_xor(a, b) {
	if (typeof a === 'boolean' && typeof b === 'boolean') {
		return (a && !b) || (!a && b);
	}
	if (__is_oak_string(a) && __is_oak_string(b)) {
		const max = Math.max(a.length, b.length);
		const get = (s, i) => s.valueOf().charCodeAt(i) || 0;

		let res = '';
		for (let i = 0; i < max; i ++) {
			res += String.fromCharCode(get(a, i) ^ get(b, i));
		}
		return res;
	}
	return a ^ b;
}
function __oak_if(cond, branches) {
	for (const [target, body] of branches) {
		if (__oak_eq(cond, target())) return body();
	}
	return null;
}
const __Oak_Empty = Symbol('__Oak_Empty');

// mutable string type
function __is_oak_string(x) {
	if (x == null) return false;
	return x.__mark_oak_string;
}
function __as_oak_string(x) {
	if (typeof x === 'string') return __Oak_String(x);
	return x;
}
const __Oak_String = s => {
	if (__is_oak_string(s)) return s;
	return {
		__mark_oak_string: true,
		assign(i, slice) {
			if (i === s.length) return s += slice;
			return s = s.substr(0, i) + slice + s.substr(i + slice.length);
		},
		push(slice) {
			s += slice;
		},
		toString() {
			return s;
		},
		valueOf() {
			return s;
		},
		get length() {
			return s.length;
		},
	}
}

// tail recursion trampoline helpers
function __oak_resolve_trampoline(fn, ...args) {
	let rv = fn(...args);
	while (rv && rv.__is_oak_trampoline) {
		rv = rv.fn(...rv.args);
	}
	return rv;
}
function __oak_trampoline(fn, ...args) {
	return {
		__is_oak_trampoline: true,
		fn: fn,
		args: args,
	}
}

// env (builtin) functions

// reflection and types
const __Is_Oak_Node = typeof process === 'object';
const __Oak_Int_RE = /^[+-]?\d+$/;
function int(x) {
	x = __as_oak_string(x);
	if (typeof x === 'number') {
		// JS rounds towards higher magnitude, Oak rounds towards higher value
		const rounded = Math.floor(x);
		const diff = x - rounded;
		if (x < 0 && diff === 0.5) return rounded + 1;
		return rounded;
	}
	if (__is_oak_string(x) && __Oak_Int_RE.test(x.valueOf())) {
		const i = Number(x.valueOf());
		if (isNaN(i)) return null;
		return i;
	}
	return null;
}
function float(x) {
	x = __as_oak_string(x);
	if (typeof x === 'number') return x;
	if (__is_oak_string(x)) {
		const f = parseFloat(x.valueOf());
		if (isNaN(f)) return null;
		return f;
	}
	return null;
}
function atom(x) {
	x = __as_oak_string(x);
	if (typeof x === 'symbol' && x !== __Oak_Empty) return x;
	if (__is_oak_string(x)) return Symbol.for(x.valueOf());
	return Symbol.for(string(x));
}
function string(x) {
	x = __as_oak_string(x);
	function display(x) {
		x = __as_oak_string(x);
		if (__is_oak_string(x)) {
			return '\'' + x.valueOf().replace('\\', '\\\\').replace('\'', '\\\'') + '\'';
		} else if (typeof x === 'symbol') {
			if (x === __Oak_Empty) return '_';
			return ':' + Symbol.keyFor(x);
		}
		return string(x);
	}
	if (x === null) {
		return '?';
	} else if (typeof x === 'number') {
		return x.toString();
	} else if (__is_oak_string(x)) {
		return x;
	} else if (typeof x === 'boolean') {
		return x.toString();
	} else if (typeof x === 'function') {
		return x.toString();
	} else if (typeof x === 'symbol') {
		if (x === __Oak_Empty) return '_';
		return Symbol.keyFor(x);
	} else if (Array.isArray(x)) {
		return '[' + x.map(display).join(', ') + ']';
	} else if (typeof x === 'object') {
		const entries = [];
		for (const key of keys(x).sort()) {
			entries.push(`${key}: ${display(x[key])}`);
		}
		return '{' + entries.join(', ') + '}';
	}
	throw new Error('string() called on unknown type ' + x.toString());
}
function codepoint(c) {
	c = __as_oak_string(c);
	return c.valueOf().charCodeAt(0);
}
function char(n) {
	return String.fromCharCode(n);
}
function type(x) {
	x = __as_oak_string(x);
	if (x === null) {
		return Symbol.for('null');
	} else if (typeof x === 'number') {
		// Many discrete APIs check for :int, so we consider all integer
		// numbers :int and fall back to :float. This is not an airtight
		// solution, but works well enough and the alternative (tagged number
		// values/types) have poor perf tradeoffs.
		if (Number.isInteger(x)) return Symbol.for('int');
		return Symbol.for('float');
	} else if (__is_oak_string(x)) {
		return Symbol.for('string');
	} else if (typeof x === 'boolean') {
		return Symbol.for('bool');
	} else if (typeof x === 'symbol') {
		if (x === __Oak_Empty) return Symbol.for('empty');
		return Symbol.for('atom');
	} else if (typeof x === 'function') {
		return Symbol.for('function');
	} else if (Array.isArray(x)) {
		return Symbol.for('list');
	} else if (typeof x === 'object') {
		return Symbol.for('object');
	}
	throw new Error('type() called on unknown type ' + x.toString());
}
function len(x) {
	x = __as_oak_string(x);
	if (__is_oak_string(x)) {
		return x.length;
	} else if (Array.isArray(x)) {
		return x.length;
	} else if (typeof x === 'object' && x !== null) {
		return Object.getOwnPropertyNames(x).length;
	}
	throw new Error('len() takes a string or composite value, but got ' + string(x));
}
function keys(x) {
	if (Array.isArray(x)) {
		const k = [];
		for (let i = 0; i < x.length; i ++) k.push(i);
		return k;
	} else if (typeof x === 'object' && x !== null) {
		return Object.getOwnPropertyNames(x).map(__as_oak_string);
	}
	throw new Error('keys() takes a composite value, but got ' + string(x).valueOf());
}

// OS interfaces
function args() {
	if (__Is_Oak_Node) return process.argv.map(__as_oak_string);
	return [window.location.href];
}
function env() {
	if (__Is_Oak_Node) {
		const e = Object.assign({}, process.env);
		for (const key in e) {
			e[key] = __as_oak_string(e[key]);
		}
		return e;
	}
	return {};
}
function time() {
	return Date.now() / 1000;
}
function nanotime() {
	return int(Date.now() * 1000000);
}
function rand() {
	return Math.random();
}
let randomBytes;
function srand(length) {
	if (__Is_Oak_Node) {
		// lazily import dependency
		if (!randomBytes) randomBytes = require('crypto').randomBytes;
		return randomBytes(length).toString('latin1');
	}

	const bytes = crypto.getRandomValues(new Uint8Array(length));
	return __as_oak_string(Array.from(bytes).map(b => String.fromCharCode(b)).join(''));
}
function wait(duration, cb) {
	setTimeout(cb, duration * 1000);
	return null;
}
function exit(code) {
	if (__Is_Oak_Node) process.exit(code);
	return null;
}
function exec() {
	throw new Error('exec() not implemented');
}

// I/O
function input() {
	throw new Error('input() not implemented');
}
function print(s) {
	s = __as_oak_string(s);
	if (__Is_Oak_Node) {
		process.stdout.write(string(s).toString());
	} else {
		console.log(string(s).toString());
	}
	return s.length;
}
function ls() {
	throw new Error('ls() not implemented');
}
function rm() {
	throw new Error('rm() not implemented');
}
function mkdir() {
	throw new Error('mkdir() not implemented');
}
function stat() {
	throw new Error('stat() not implemented');
}
function open() {
	throw new Error('open() not implemented');
}
function close() {
	throw new Error('close() not implemented');
}
function read() {
	throw new Error('read() not implemented');
}
function write() {
	throw new Error('write() not implemented');
}
function listen() {
	throw new Error('listen() not implemented');
}
function req() {
	throw new Error('req() not implemented');
}

// math
function sin(n) {
	return Math.sin(n);
}
function cos(n) {
	return Math.cos(n);
}
function tan(n) {
	return Math.tan(n);
}
function asin(n) {
	return Math.asin(n);
}
function acos(n) {
	return Math.acos(n);
}
function atan(n) {
	return Math.atan(n);
}
function pow(b, n) {
	return Math.pow(b, n);
}
function log(b, n) {
	return Math.log(n) / Math.log(b);
}

// runtime
function ___runtime_lib() {
	throw new Error('___runtime_lib() not implemented');
}
function ___runtime_lib__oak_qm() {
	throw new Error('___runtime_lib?() not implemented');
}

// JavaScript interop
function bind(target, fn) {
	const fnName = Symbol.keyFor(fn);
	return target[fnName].bind(target);
}
function __oak_js_new(Constructor, ...args) {
	return new Constructor(...args);
}
(__oak_modularize(__Oak_String(``),function(){return (()=>{ let Canvas;let Ctx;let Heads;let InnerHeight;let InnerWidth;let LeftArms;let LeftLegs;let Light;let Origins;let RightArms;let RightLegs;let Scale;let ShadowCanvas;let ShadowCtx;let SilhouetteCanvas;let SilhouetteCtx;let Torsos;let __module;let addHandler;let angle;let append;let bearing;let choice;let circle;let ctxCall;let __oak_js_default;let draw;let each;let fill;let handleResize;let integer;let limb;let makeHuman;let map;let math;let merge;let number;let partition;let path;let println;let querySelector;let querySelectorAll;let randomize;let range;let shadow;let slice;(__module={});({println:println=null,__oak_js_default:__oak_js_default=null,range:range=null,slice:slice=null,map:map=null,each:each=null,merge:merge=null,append:append=null,partition:partition=null}=__oak_module_import(__Oak_String(`std`)));(math=__oak_module_import(__Oak_String(`math`)));({integer:integer=null,number:number=null,choice:choice=null}=__oak_module_import(__Oak_String(`random`)));(InnerWidth=(()=>{let __oak_acc_trgt=__as_oak_string(window);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[innerWidth])||null:(__oak_acc_trgt.innerWidth!==undefined?__oak_acc_trgt.innerWidth:null)})());(InnerHeight=(()=>{let __oak_acc_trgt=__as_oak_string(window);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[innerHeight])||null:(__oak_acc_trgt.innerHeight!==undefined?__oak_acc_trgt.innerHeight:null)})());(Scale=3);(Light=[InnerWidth,0]);(Origins=[]);(Heads=[]);(Torsos=[]);(LeftArms=[]);(RightArms=[]);(LeftLegs=[]);(RightLegs=[]);(querySelector=bind(document,Symbol.for('querySelector')));(querySelectorAll=bind(document,Symbol.for('querySelectorAll')));addHandler=function addHandler(el=null,name=null,handler=null){return bind(el,Symbol.for('addEventListener'))(string(name),handler)};(Canvas=querySelector(__Oak_String(`#silhouettes`)));(Ctx=bind(Canvas,Symbol.for('getContext'))(__Oak_String(`2d`)));(SilhouetteCanvas=querySelector(__Oak_String(`#silhouettes`)));(SilhouetteCtx=bind(Canvas,Symbol.for('getContext'))(__Oak_String(`2d`)));(ShadowCanvas=querySelector(__Oak_String(`#shadows`)));(ShadowCtx=bind(ShadowCanvas,Symbol.for('getContext'))(__Oak_String(`2d`)));ctxCall=function ctxCall(name=null,...args){return bind(Ctx,name)(...args)};path=function path(points=null){return (()=>{ let start;(start=(()=>{let __oak_acc_trgt=__as_oak_string(points);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[0])||null:(__oak_acc_trgt[0]!==undefined?__oak_acc_trgt[0]:null)})());ctxCall(Symbol.for('beginPath'));ctxCall(Symbol.for('moveTo'),(()=>{let __oak_acc_trgt=__as_oak_string(start);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[0])||null:(__oak_acc_trgt[0]!==undefined?__oak_acc_trgt[0]:null)})(),(()=>{let __oak_acc_trgt=__as_oak_string(start);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[1])||null:(__oak_acc_trgt[1]!==undefined?__oak_acc_trgt[1]:null)})());each(slice(points,1),function(pt=null){return (ctxCall(Symbol.for('lineTo'),(()=>{let __oak_acc_trgt=__as_oak_string(pt);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[0])||null:(__oak_acc_trgt[0]!==undefined?__oak_acc_trgt[0]:null)})(),(()=>{let __oak_acc_trgt=__as_oak_string(pt);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[1])||null:(__oak_acc_trgt[1]!==undefined?__oak_acc_trgt[1]:null)})()))});return ctxCall(Symbol.for('stroke')) })()};fill=function fill(points=null){return (()=>{ let start;ctxCall(Symbol.for('beginPath'));(start=(()=>{let __oak_acc_trgt=__as_oak_string(points);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[0])||null:(__oak_acc_trgt[0]!==undefined?__oak_acc_trgt[0]:null)})());ctxCall(Symbol.for('moveTo'),(()=>{let __oak_acc_trgt=__as_oak_string(start);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[0])||null:(__oak_acc_trgt[0]!==undefined?__oak_acc_trgt[0]:null)})(),(()=>{let __oak_acc_trgt=__as_oak_string(start);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[1])||null:(__oak_acc_trgt[1]!==undefined?__oak_acc_trgt[1]:null)})());each(slice(points,1),function(pt=null){return (ctxCall(Symbol.for('lineTo'),(()=>{let __oak_acc_trgt=__as_oak_string(pt);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[0])||null:(__oak_acc_trgt[0]!==undefined?__oak_acc_trgt[0]:null)})(),(()=>{let __oak_acc_trgt=__as_oak_string(pt);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[1])||null:(__oak_acc_trgt[1]!==undefined?__oak_acc_trgt[1]:null)})()))});return ctxCall(Symbol.for('fill')) })()};circle=function circle(center=null,radius=null){return (ctxCall(Symbol.for('beginPath')),ctxCall(Symbol.for('arc'),(()=>{let __oak_acc_trgt=__as_oak_string(center);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[0])||null:(__oak_acc_trgt[0]!==undefined?__oak_acc_trgt[0]:null)})(),(()=>{let __oak_acc_trgt=__as_oak_string(center);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[1])||null:(__oak_acc_trgt[1]!==undefined?__oak_acc_trgt[1]:null)})(),radius,0,(2*(()=>{let __oak_acc_trgt=__as_oak_string(math);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[Pi])||null:(__oak_acc_trgt.Pi!==undefined?__oak_acc_trgt.Pi:null)})())),ctxCall(Symbol.for('fill')))};angle=function angle(deg=null){return (((__as_oak_string(-deg+90))/180)*(()=>{let __oak_acc_trgt=__as_oak_string(math);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[Pi])||null:(__oak_acc_trgt.Pi!==undefined?__oak_acc_trgt.Pi:null)})())};bearing=function bearing(x=null,y=null,angle=null,dist=null){return [__as_oak_string(x+(cos(angle)*dist)),__as_oak_string(y+(sin(angle)*dist))]};limb=function limb(start=null,deg1=null,len1=null,deg2=null,len2=null){let p;return [(p=start),(p=bearing((()=>{let __oak_acc_trgt=__as_oak_string(p);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[0])||null:(__oak_acc_trgt[0]!==undefined?__oak_acc_trgt[0]:null)})(),(()=>{let __oak_acc_trgt=__as_oak_string(p);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[1])||null:(__oak_acc_trgt[1]!==undefined?__oak_acc_trgt[1]:null)})(),angle(deg1),len1)),bearing((()=>{let __oak_acc_trgt=__as_oak_string(p);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[0])||null:(__oak_acc_trgt[0]!==undefined?__oak_acc_trgt[0]:null)})(),(()=>{let __oak_acc_trgt=__as_oak_string(p);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[1])||null:(__oak_acc_trgt[1]!==undefined?__oak_acc_trgt[1]:null)})(),angle(__as_oak_string(deg1+deg2)),len2)]};shadow=function shadow(pt=null,origin=null){return (()=>{ let ox;let oy;let skew;let squish;let x;let y;([x,y=null]=origin);([ox,oy=null]=pt);(squish=((((y-(()=>{let __oak_acc_trgt=__as_oak_string(Light);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[1])||null:(__oak_acc_trgt[1]!==undefined?__oak_acc_trgt[1]:null)})()))/InnerHeight)*1.5));(skew=((((x-(()=>{let __oak_acc_trgt=__as_oak_string(Light);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[0])||null:(__oak_acc_trgt[0]!==undefined?__oak_acc_trgt[0]:null)})()))/InnerWidth)*1.5));return [__as_oak_string(ox+(skew*((y-oy)))),(y-(((oy-y))*squish))] })()};makeHuman=function makeHuman(x=null,y=null,posture=null){return (()=>{ let facing;(posture=__oak_js_default(posture,{}));(facing=__oak_js_default((()=>{let __oak_acc_trgt=__as_oak_string(posture);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[facing])||null:(__oak_acc_trgt.facing!==undefined?__oak_acc_trgt.facing:null)})(),choice([Symbol.for('forward'),Symbol.for('left'),Symbol.for('right')])));(posture=merge({leftShoulder:number(-80,0),leftElbow:__oak_if(facing,[[()=>(Symbol.for('left')),()=>(number(-135,0))],[()=>(Symbol.for('right')),()=>(number(0,30))],[()=>(__Oak_Empty),()=>(number(-135,20))]]),rightShoulder:number(0,80),rightElbow:__oak_if(facing,[[()=>(Symbol.for('right')),()=>(number(0,135))],[()=>(Symbol.for('left')),()=>(number(-30,0))],[()=>(__Oak_Empty),()=>(number(-20,135))]]),leftHip:__oak_if(facing,[[()=>(Symbol.for('left')),()=>(number(-70,30))],[()=>(Symbol.for('right')),()=>(number(-80,20))],[()=>(__Oak_Empty),()=>(number(10,10))]]),leftKnee:__oak_if(facing,[[()=>(Symbol.for('left')),()=>(number(10,80))],[()=>(Symbol.for('right')),()=>(number(-80,-10))],[()=>(__Oak_Empty),()=>(number(0,10))]]),rightHip:__oak_if(facing,[[()=>(Symbol.for('right')),()=>(number(-30,70))],[()=>(Symbol.for('left')),()=>(number(-20,80))],[()=>(__Oak_Empty),()=>(number(10,10))]]),rightKnee:__oak_if(facing,[[()=>(Symbol.for('right')),()=>(number(-80,-10))],[()=>(Symbol.for('left')),()=>(number(10,80))],[()=>(__Oak_Empty),()=>(number(-10,0))]])},posture));__oak_push(Origins,[x,y]);__oak_push(Heads,__oak_if((()=>{let __oak_acc_trgt=__as_oak_string(posture);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[facing])||null:(__oak_acc_trgt.facing!==undefined?__oak_acc_trgt.facing:null)})(),[[()=>(Symbol.for('left')),()=>([__as_oak_string(x+Scale),(y-(11*Scale))])],[()=>(Symbol.for('right')),()=>([__as_oak_string(x+(2*Scale)),(y-(11*Scale))])],[()=>(__Oak_Empty),()=>([__as_oak_string(x+(1.5*Scale)),(y-(11*Scale))])]]));__oak_push(Torsos,[[x,(y-(9*Scale))],[__as_oak_string(x+(3*Scale)),(y-(9*Scale))],[__as_oak_string(x+(3*Scale)),(y-(4*Scale))],[x,(y-(4*Scale))]]);__oak_push(LeftArms,limb([x,(y-(8*Scale))],(()=>{let __oak_acc_trgt=__as_oak_string(posture);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[leftShoulder])||null:(__oak_acc_trgt.leftShoulder!==undefined?__oak_acc_trgt.leftShoulder:null)})(),(2*Scale),(()=>{let __oak_acc_trgt=__as_oak_string(posture);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[leftElbow])||null:(__oak_acc_trgt.leftElbow!==undefined?__oak_acc_trgt.leftElbow:null)})(),(1.5*Scale)));__oak_push(RightArms,limb([__as_oak_string(x+(3*Scale)),(y-(8*Scale))],(()=>{let __oak_acc_trgt=__as_oak_string(posture);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[rightShoulder])||null:(__oak_acc_trgt.rightShoulder!==undefined?__oak_acc_trgt.rightShoulder:null)})(),(2*Scale),(()=>{let __oak_acc_trgt=__as_oak_string(posture);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[rightElbow])||null:(__oak_acc_trgt.rightElbow!==undefined?__oak_acc_trgt.rightElbow:null)})(),(1.5*Scale)));__oak_push(LeftLegs,limb([__as_oak_string(x+(Scale/2)),(y-(4*Scale))],(()=>{let __oak_acc_trgt=__as_oak_string(posture);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[leftHip])||null:(__oak_acc_trgt.leftHip!==undefined?__oak_acc_trgt.leftHip:null)})(),(2*Scale),(()=>{let __oak_acc_trgt=__as_oak_string(posture);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[leftKnee])||null:(__oak_acc_trgt.leftKnee!==undefined?__oak_acc_trgt.leftKnee:null)})(),(2*Scale)));return __oak_push(RightLegs,limb([__as_oak_string(x+(Scale*2.5)),(y-(4*Scale))],(()=>{let __oak_acc_trgt=__as_oak_string(posture);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[rightHip])||null:(__oak_acc_trgt.rightHip!==undefined?__oak_acc_trgt.rightHip:null)})(),(2*Scale),(()=>{let __oak_acc_trgt=__as_oak_string(posture);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[rightKnee])||null:(__oak_acc_trgt.rightKnee!==undefined?__oak_acc_trgt.rightKnee:null)})(),(2*Scale))) })()};draw=function draw(){return (()=>{ let Gradients;(Ctx=ShadowCtx);(()=>{let __oak_assgn_trgt=__as_oak_string(Ctx);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(lineWidth,Scale):((__oak_assgn_trgt.lineWidth)=Scale);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(Ctx);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(strokeStyle,__Oak_String(`rgba(0, 0, 0, .3)`)):((__oak_assgn_trgt.strokeStyle)=__Oak_String(`rgba(0, 0, 0, .3)`));return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(Ctx);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(fillStyle,__Oak_String(`rgba(0, 0, 0, .3)`)):((__oak_assgn_trgt.fillStyle)=__Oak_String(`rgba(0, 0, 0, .3)`));return __oak_assgn_trgt})();ctxCall(Symbol.for('clearRect'),0,0,(()=>{let __oak_acc_trgt=__as_oak_string(Canvas);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[width])||null:(__oak_acc_trgt.width!==undefined?__oak_acc_trgt.width:null)})(),(()=>{let __oak_acc_trgt=__as_oak_string(Canvas);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[height])||null:(__oak_acc_trgt.height!==undefined?__oak_acc_trgt.height:null)})());each(Heads,function(head=null,i=null){return (circle(shadow(head,(()=>{let __oak_acc_trgt=__as_oak_string(Origins);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(i)])||null:(__oak_acc_trgt[(i)]!==undefined?__oak_acc_trgt[(i)]:null)})()),Scale))});each(Torsos,function(torso=null,i=null){return (()=>{ let origin;(origin=(()=>{let __oak_acc_trgt=__as_oak_string(Origins);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(i)])||null:(__oak_acc_trgt[(i)]!==undefined?__oak_acc_trgt[(i)]:null)})());return fill(map(torso,function(pt=null){return shadow(pt,origin)})) })()});each(LeftArms,function(arm=null,i=null){return (()=>{ let origin;(origin=(()=>{let __oak_acc_trgt=__as_oak_string(Origins);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(i)])||null:(__oak_acc_trgt[(i)]!==undefined?__oak_acc_trgt[(i)]:null)})());return path(map(arm,function(pt=null){return shadow(pt,origin)})) })()});each(RightArms,function(arm=null,i=null){return (()=>{ let origin;(origin=(()=>{let __oak_acc_trgt=__as_oak_string(Origins);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(i)])||null:(__oak_acc_trgt[(i)]!==undefined?__oak_acc_trgt[(i)]:null)})());return path(map(arm,function(pt=null){return shadow(pt,origin)})) })()});each(LeftLegs,function(leg=null,i=null){return (()=>{ let origin;(origin=(()=>{let __oak_acc_trgt=__as_oak_string(Origins);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(i)])||null:(__oak_acc_trgt[(i)]!==undefined?__oak_acc_trgt[(i)]:null)})());return path(map(leg,function(pt=null){return shadow(pt,origin)})) })()});each(RightLegs,function(leg=null,i=null){return (()=>{ let origin;(origin=(()=>{let __oak_acc_trgt=__as_oak_string(Origins);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(i)])||null:(__oak_acc_trgt[(i)]!==undefined?__oak_acc_trgt[(i)]:null)})());return path(map(leg,function(pt=null){return shadow(pt,origin)})) })()});(Ctx=SilhouetteCtx);(()=>{let __oak_assgn_trgt=__as_oak_string(Ctx);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(lineWidth,Scale):((__oak_assgn_trgt.lineWidth)=Scale);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(Ctx);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(lineCap,__Oak_String(`round`)):((__oak_assgn_trgt.lineCap)=__Oak_String(`round`));return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(Ctx);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(lineJoin,__Oak_String(`round`)):((__oak_assgn_trgt.lineJoin)=__Oak_String(`round`));return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(Ctx);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(fillStyle,__Oak_String(`#000000`)):((__oak_assgn_trgt.fillStyle)=__Oak_String(`#000000`));return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(Ctx);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(filter,__Oak_String(`none`)):((__oak_assgn_trgt.filter)=__Oak_String(`none`));return __oak_assgn_trgt})();ctxCall(Symbol.for('clearRect'),0,0,(()=>{let __oak_acc_trgt=__as_oak_string(Canvas);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[width])||null:(__oak_acc_trgt.width!==undefined?__oak_acc_trgt.width:null)})(),(()=>{let __oak_acc_trgt=__as_oak_string(Canvas);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[height])||null:(__oak_acc_trgt.height!==undefined?__oak_acc_trgt.height:null)})());(Gradients=map(Origins,function(origin=null){return (()=>{ let grad;let x;let y;([x,y=null]=origin);(grad=ctxCall(Symbol.for('createLinearGradient'),__as_oak_string(x+Scale),y,...shadow([__as_oak_string(x+(1*Scale)),(y-(4*Scale))],[__as_oak_string(x+Scale),y])));bind(grad,Symbol.for('addColorStop'))(0,__Oak_String(`rgba(0, 0, 0, .2)`));bind(grad,Symbol.for('addColorStop'))(1,__Oak_String(`rgba(0, 0, 0, 0)`));return grad })()}));each(LeftLegs,function(leg=null,i=null){return (()=>{ let grad;let origin;(origin=(()=>{let __oak_acc_trgt=__as_oak_string(Origins);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(i)])||null:(__oak_acc_trgt[(i)]!==undefined?__oak_acc_trgt[(i)]:null)})());(grad=(()=>{let __oak_acc_trgt=__as_oak_string(Gradients);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(i)])||null:(__oak_acc_trgt[(i)]!==undefined?__oak_acc_trgt[(i)]:null)})());(()=>{let __oak_assgn_trgt=__as_oak_string(Ctx);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(strokeStyle,grad):((__oak_assgn_trgt.strokeStyle)=grad);return __oak_assgn_trgt})();return path(map(leg,function(pt=null){return (shadow(pt,origin))})) })()});each(RightLegs,function(leg=null,i=null){return (()=>{ let grad;let origin;(origin=(()=>{let __oak_acc_trgt=__as_oak_string(Origins);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(i)])||null:(__oak_acc_trgt[(i)]!==undefined?__oak_acc_trgt[(i)]:null)})());(grad=(()=>{let __oak_acc_trgt=__as_oak_string(Gradients);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(i)])||null:(__oak_acc_trgt[(i)]!==undefined?__oak_acc_trgt[(i)]:null)})());(()=>{let __oak_assgn_trgt=__as_oak_string(Ctx);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(strokeStyle,grad):((__oak_assgn_trgt.strokeStyle)=grad);return __oak_assgn_trgt})();return path(map(leg,function(pt=null){return (shadow(pt,origin))})) })()});(()=>{let __oak_assgn_trgt=__as_oak_string(Ctx);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(strokeStyle,__Oak_String(`#000000`)):((__oak_assgn_trgt.strokeStyle)=__Oak_String(`#000000`));return __oak_assgn_trgt})();each(Heads,function(head=null){return circle(head,Scale)});each(Torsos,function(torso=null){return fill(torso)});each(LeftArms,function(arm=null){return path(arm)});each(RightArms,function(arm=null){return path(arm)});each(LeftLegs,function(leg=null){return path(leg)});return each(RightLegs,function(leg=null){return path(leg)}) })()};handleResize=function handleResize(){return ((InnerWidth=(()=>{let __oak_acc_trgt=__as_oak_string(window);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[innerWidth])||null:(__oak_acc_trgt.innerWidth!==undefined?__oak_acc_trgt.innerWidth:null)})()),(InnerHeight=(()=>{let __oak_acc_trgt=__as_oak_string(window);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[innerHeight])||null:(__oak_acc_trgt.innerHeight!==undefined?__oak_acc_trgt.innerHeight:null)})()),(()=>{let __oak_assgn_trgt=__as_oak_string(SilhouetteCanvas);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(width,InnerWidth):((__oak_assgn_trgt.width)=InnerWidth);return __oak_assgn_trgt})(),(()=>{let __oak_assgn_trgt=__as_oak_string(SilhouetteCanvas);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(height,InnerHeight):((__oak_assgn_trgt.height)=InnerHeight);return __oak_assgn_trgt})(),(()=>{let __oak_assgn_trgt=__as_oak_string(ShadowCanvas);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(width,InnerWidth):((__oak_assgn_trgt.width)=InnerWidth);return __oak_assgn_trgt})(),(()=>{let __oak_assgn_trgt=__as_oak_string(ShadowCanvas);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(height,InnerHeight):((__oak_assgn_trgt.height)=InnerHeight);return __oak_assgn_trgt})(),draw())};randomize=function randomize(n=null){return (()=>{ let margin;let randomCoord;(margin=(Scale*12));randomCoord=function randomCoord(){return [integer(margin,(InnerWidth-margin)),integer(margin,(InnerHeight-margin))]};each(map(range(n),randomCoord),function(pt=null){return makeHuman((()=>{let __oak_acc_trgt=__as_oak_string(pt);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[0])||null:(__oak_acc_trgt[0]!==undefined?__oak_acc_trgt[0]:null)})(),(()=>{let __oak_acc_trgt=__as_oak_string(pt);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[1])||null:(__oak_acc_trgt[1]!==undefined?__oak_acc_trgt[1]:null)})())});return draw() })()};handleResize();addHandler(window,Symbol.for('resize'),handleResize);addHandler(Canvas,Symbol.for('click'),function(evt=null){return __oak_if(true,[[()=>((()=>{let __oak_acc_trgt=__as_oak_string(evt);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[altKey])||null:(__oak_acc_trgt.altKey!==undefined?__oak_acc_trgt.altKey:null)})()),()=>((()=>{ let x;let y;({clientX:x=null,clientY:y=null}=evt);(Light=[x,y]);return draw() })())],[()=>((()=>{let __oak_acc_trgt=__as_oak_string(evt);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[metaKey])||null:(__oak_acc_trgt.metaKey!==undefined?__oak_acc_trgt.metaKey:null)})()),()=>((()=>{ let x;let y;({clientX:x=null,clientY:y=null}=evt);(Light=[x,y]);return draw() })())],[()=>(__Oak_Empty),()=>((()=>{ let x;let y;({clientX:x=null,clientY:y=null}=evt);makeHuman(x,y);return draw() })())]])});addHandler(querySelector(__Oak_String(`.randomizeButton`)),Symbol.for('click'),function(){return (randomize(10))});addHandler(querySelector(__Oak_String(`.clearButton`)),Symbol.for('click'),function(){return ((Origins=[]),(Heads=[]),(Torsos=[]),(LeftArms=[]),(RightArms=[]),(LeftLegs=[]),(RightLegs=[]),draw())});randomize((()=>{let __oak_acc_trgt=__as_oak_string(math);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[max])||null:(__oak_acc_trgt.max!==undefined?__oak_acc_trgt.max:null)})()(10,int(((InnerWidth*InnerHeight)/40000))));(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(Canvas,Canvas):((__oak_assgn_trgt.Canvas)=Canvas);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(Ctx,Ctx):((__oak_assgn_trgt.Ctx)=Ctx);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(Heads,Heads):((__oak_assgn_trgt.Heads)=Heads);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(InnerHeight,InnerHeight):((__oak_assgn_trgt.InnerHeight)=InnerHeight);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(InnerWidth,InnerWidth):((__oak_assgn_trgt.InnerWidth)=InnerWidth);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(LeftArms,LeftArms):((__oak_assgn_trgt.LeftArms)=LeftArms);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(LeftLegs,LeftLegs):((__oak_assgn_trgt.LeftLegs)=LeftLegs);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(Light,Light):((__oak_assgn_trgt.Light)=Light);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(Origins,Origins):((__oak_assgn_trgt.Origins)=Origins);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(RightArms,RightArms):((__oak_assgn_trgt.RightArms)=RightArms);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(RightLegs,RightLegs):((__oak_assgn_trgt.RightLegs)=RightLegs);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(Scale,Scale):((__oak_assgn_trgt.Scale)=Scale);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(ShadowCanvas,ShadowCanvas):((__oak_assgn_trgt.ShadowCanvas)=ShadowCanvas);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(ShadowCtx,ShadowCtx):((__oak_assgn_trgt.ShadowCtx)=ShadowCtx);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(SilhouetteCanvas,SilhouetteCanvas):((__oak_assgn_trgt.SilhouetteCanvas)=SilhouetteCanvas);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(SilhouetteCtx,SilhouetteCtx):((__oak_assgn_trgt.SilhouetteCtx)=SilhouetteCtx);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(Torsos,Torsos):((__oak_assgn_trgt.Torsos)=Torsos);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(addHandler,addHandler):((__oak_assgn_trgt.addHandler)=addHandler);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(angle,angle):((__oak_assgn_trgt.angle)=angle);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(append,append):((__oak_assgn_trgt.append)=append);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(bearing,bearing):((__oak_assgn_trgt.bearing)=bearing);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(choice,choice):((__oak_assgn_trgt.choice)=choice);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(circle,circle):((__oak_assgn_trgt.circle)=circle);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(ctxCall,ctxCall):((__oak_assgn_trgt.ctxCall)=ctxCall);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(__oak_js_default,__oak_js_default):((__oak_assgn_trgt.__oak_js_default)=__oak_js_default);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(draw,draw):((__oak_assgn_trgt.draw)=draw);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(each,each):((__oak_assgn_trgt.each)=each);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(fill,fill):((__oak_assgn_trgt.fill)=fill);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(handleResize,handleResize):((__oak_assgn_trgt.handleResize)=handleResize);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(integer,integer):((__oak_assgn_trgt.integer)=integer);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(limb,limb):((__oak_assgn_trgt.limb)=limb);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(makeHuman,makeHuman):((__oak_assgn_trgt.makeHuman)=makeHuman);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(map,map):((__oak_assgn_trgt.map)=map);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(math,math):((__oak_assgn_trgt.math)=math);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(merge,merge):((__oak_assgn_trgt.merge)=merge);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(number,number):((__oak_assgn_trgt.number)=number);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(partition,partition):((__oak_assgn_trgt.partition)=partition);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(path,path):((__oak_assgn_trgt.path)=path);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(println,println):((__oak_assgn_trgt.println)=println);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(querySelector,querySelector):((__oak_assgn_trgt.querySelector)=querySelector);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(querySelectorAll,querySelectorAll):((__oak_assgn_trgt.querySelectorAll)=querySelectorAll);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(randomize,randomize):((__oak_assgn_trgt.randomize)=randomize);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(range,range):((__oak_assgn_trgt.range)=range);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(shadow,shadow):((__oak_assgn_trgt.shadow)=shadow);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(slice,slice):((__oak_assgn_trgt.slice)=slice);return __oak_assgn_trgt})();return __module })()}),__oak_modularize(__Oak_String(`math`),function(){return (()=>{ let E;let Pi;let __module;let abs;let __oak_js_default;let max;let min;let reduce;let round;let sign;let sum;(__module={});({__oak_js_default:__oak_js_default=null,reduce:reduce=null}=__oak_module_import(__Oak_String(`std`)));(Pi=3.141592653589793);(E=2.718281828459045);sign=function sign(n=null){return __oak_if((n>=0),[[()=>(true),()=>(1)],[()=>(__Oak_Empty),()=>(-1)]])};abs=function abs(n=null){return __oak_if((n>=0),[[()=>(true),()=>(n)],[()=>(__Oak_Empty),()=>(-n)]])};sum=function sum(...xs){return reduce(xs,0,function(a=null,b=null){return __as_oak_string(a+b)})};min=function min(...xs){return reduce(xs,(()=>{let __oak_acc_trgt=__as_oak_string(xs);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[0])||null:(__oak_acc_trgt[0]!==undefined?__oak_acc_trgt[0]:null)})(),function(acc=null,n=null){return __oak_if((n<acc),[[()=>(true),()=>(n)],[()=>(__Oak_Empty),()=>(acc)]])})};max=function max(...xs){return reduce(xs,(()=>{let __oak_acc_trgt=__as_oak_string(xs);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[0])||null:(__oak_acc_trgt[0]!==undefined?__oak_acc_trgt[0]:null)})(),function(acc=null,n=null){return __oak_if((n>acc),[[()=>(true),()=>(n)],[()=>(__Oak_Empty),()=>(acc)]])})};round=function round(n=null,decimals=null){return ((decimals=__oak_js_default(int(decimals),0)),__oak_if((decimals<0),[[()=>(true),()=>(n)],[()=>(__Oak_Empty),()=>((()=>{ let order;(order=pow(10,decimals));return __oak_if((n>=0),[[()=>(true),()=>((int(__as_oak_string((n*order)+0.5))/order))],[()=>(__Oak_Empty),()=>((-int(__as_oak_string((-n*order)+0.5))/order))]]) })())]]))};(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(E,E):((__oak_assgn_trgt.E)=E);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(Pi,Pi):((__oak_assgn_trgt.Pi)=Pi);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(abs,abs):((__oak_assgn_trgt.abs)=abs);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(__oak_js_default,__oak_js_default):((__oak_assgn_trgt.__oak_js_default)=__oak_js_default);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(max,max):((__oak_assgn_trgt.max)=max);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(min,min):((__oak_assgn_trgt.min)=min);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(reduce,reduce):((__oak_assgn_trgt.reduce)=reduce);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(round,round):((__oak_assgn_trgt.round)=round);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(sign,sign):((__oak_assgn_trgt.sign)=sign);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(sum,sum):((__oak_assgn_trgt.sum)=sum);return __oak_assgn_trgt})();return __module })()}),__oak_modularize(__Oak_String(`random`),function(){return (()=>{ let __module;let boolean;let choice;let integer;let map;let number;let split;let toHex;(__module={});({toHex:toHex=null,map:map=null}=__oak_module_import(__Oak_String(`std`)));({split:split=null}=__oak_module_import(__Oak_String(`str`)));boolean=function boolean(){return (rand()>0.5)};integer=function integer(min=null,max=null){return int(number(int(min),int(max)))};number=function number(min=null,max=null){return (__oak_if(max,[[()=>(null),()=>(([min,max=null]=[0,min]))]]),__as_oak_string(min+(rand()*((max-min)))))};choice=function choice(list=null){return (()=>{let __oak_acc_trgt=__as_oak_string(list);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(integer(0,len(list)))])||null:(__oak_acc_trgt[(integer(0,len(list)))]!==undefined?__oak_acc_trgt[(integer(0,len(list)))]:null)})()};(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(boolean,boolean):((__oak_assgn_trgt.boolean)=boolean);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(choice,choice):((__oak_assgn_trgt.choice)=choice);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(integer,integer):((__oak_assgn_trgt.integer)=integer);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(map,map):((__oak_assgn_trgt.map)=map);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(number,number):((__oak_assgn_trgt.number)=number);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(split,split):((__oak_assgn_trgt.split)=split);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(toHex,toHex):((__oak_assgn_trgt.toHex)=toHex);return __oak_assgn_trgt})();return __module })()}),__oak_modularize(__Oak_String(`std`),function(){return (()=>{ let __module;let _baseIterator;let _hToN;let _nToH;let append;let clamp;let clone;let contains__oak_qm;let debounce;let __oak_js_default;let each;let entries;let every;let filter;let find;let flatten;let fromHex;let identity;let indexOf;let join;let loop;let map;let merge;let once;let partition;let println;let range;let reduce;let reverse;let slice;let some;let toHex;let uniq;let values;let zip;(__module={});identity=function identity(x=null){return x};_baseIterator=function _baseIterator(v=null){return __oak_if(type(v),[[()=>(Symbol.for('string')),()=>(__Oak_String(``))],[()=>(Symbol.for('list')),()=>([])],[()=>(Symbol.for('object')),()=>({})]])};__oak_js_default=function __oak_js_default(x=null,base=null){return __oak_if(x,[[()=>(null),()=>(base)],[()=>(__Oak_Empty),()=>(x)]])};(_nToH=__Oak_String(`0123456789abcdef`));toHex=function toHex(n=null){return (()=>{ let sub;sub=function sub(p=null,acc=null){return (()=>{ let __oak_trampolined_sub;(__oak_trampolined_sub=function(p=null,acc=null){return __oak_if((p<16),[[()=>(true),()=>(__as_oak_string((()=>{let __oak_acc_trgt=__as_oak_string(_nToH);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(p)])||null:(__oak_acc_trgt[(p)]!==undefined?__oak_acc_trgt[(p)]:null)})()+acc))],[()=>(__Oak_Empty),()=>(__oak_trampoline(__oak_trampolined_sub,int((p/16)),__as_oak_string((()=>{let __oak_acc_trgt=__as_oak_string(_nToH);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[((p%16))])||null:(__oak_acc_trgt[((p%16))]!==undefined?__oak_acc_trgt[((p%16))]:null)})()+acc)))]])});return __oak_resolve_trampoline(__oak_trampolined_sub,p,acc) })()};return sub(int(n),__Oak_String(``)) })()};(_hToN={0:0,1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,a:10,b:11,c:12,d:13,e:14,f:15});fromHex=function fromHex(s=null){return (()=>{ let sub;sub=function sub(i=null,acc=null){return (()=>{ let __oak_trampolined_sub;(__oak_trampolined_sub=function(i=null,acc=null){return __oak_if(i,[[()=>(len(s)),()=>(acc)],[()=>(__Oak_Empty),()=>(__oak_trampoline(__oak_trampolined_sub,__as_oak_string(i+1),__as_oak_string((acc*16)+(()=>{let __oak_acc_trgt=__as_oak_string(_hToN);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[((()=>{let __oak_acc_trgt=__as_oak_string(s);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(i)])||null:(__oak_acc_trgt[(i)]!==undefined?__oak_acc_trgt[(i)]:null)})())])||null:(__oak_acc_trgt[((()=>{let __oak_acc_trgt=__as_oak_string(s);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(i)])||null:(__oak_acc_trgt[(i)]!==undefined?__oak_acc_trgt[(i)]:null)})())]!==undefined?__oak_acc_trgt[((()=>{let __oak_acc_trgt=__as_oak_string(s);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(i)])||null:(__oak_acc_trgt[(i)]!==undefined?__oak_acc_trgt[(i)]:null)})())]:null)})())))]])});return __oak_resolve_trampoline(__oak_trampolined_sub,i,acc) })()};return sub(0,0) })()};clamp=function clamp(min=null,max=null,n=null,m=null){return ((n=__oak_if((n<min),[[()=>(true),()=>(min)],[()=>(__Oak_Empty),()=>(n)]])),(m=__oak_if((m<min),[[()=>(true),()=>(min)],[()=>(__Oak_Empty),()=>(m)]])),(m=__oak_if((m>max),[[()=>(true),()=>(max)],[()=>(__Oak_Empty),()=>(m)]])),(n=__oak_if((n>m),[[()=>(true),()=>(m)],[()=>(__Oak_Empty),()=>(n)]])),[n,m])};slice=function slice(xs=null,min=null,max=null){return (()=>{ let sub;(min=__oak_js_default(min,0));(max=__oak_js_default(max,len(xs)));([min,max=null]=clamp(0,len(xs),min,max));sub=function sub(acc=null,i=null){return (()=>{ let __oak_trampolined_sub;(__oak_trampolined_sub=function(acc=null,i=null){return __oak_if(i,[[()=>(max),()=>(acc)],[()=>(__Oak_Empty),()=>(__oak_trampoline(__oak_trampolined_sub,__oak_push(acc,(()=>{let __oak_acc_trgt=__as_oak_string(xs);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(i)])||null:(__oak_acc_trgt[(i)]!==undefined?__oak_acc_trgt[(i)]:null)})()),__as_oak_string(i+1)))]])});return __oak_resolve_trampoline(__oak_trampolined_sub,acc,i) })()};return sub(_baseIterator(xs),min) })()};clone=function clone(x=null){return __oak_if(type(x),[[()=>(Symbol.for('string')),()=>(__as_oak_string(__Oak_String(``)+x))],[()=>(Symbol.for('list')),()=>(slice(x))],[()=>(Symbol.for('object')),()=>(reduce(keys(x),{},function(acc=null,key=null){return (()=>{let __oak_assgn_trgt=__as_oak_string(acc);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign((key),(()=>{let __oak_acc_trgt=__as_oak_string(x);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(key)])||null:(__oak_acc_trgt[(key)]!==undefined?__oak_acc_trgt[(key)]:null)})()):((__oak_assgn_trgt[(key)])=(()=>{let __oak_acc_trgt=__as_oak_string(x);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(key)])||null:(__oak_acc_trgt[(key)]!==undefined?__oak_acc_trgt[(key)]:null)})());return __oak_assgn_trgt})()}))],[()=>(__Oak_Empty),()=>(x)]])};append=function append(xs=null,ys=null){return (()=>{ let xlen;(xlen=len(xs));each(ys,function(y=null,i=null){return (()=>{let __oak_assgn_trgt=__as_oak_string(xs);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign((__as_oak_string(xlen+i)),y):((__oak_assgn_trgt[(__as_oak_string(xlen+i))])=y);return __oak_assgn_trgt})()});return xs })()};join=function join(xs=null,ys=null){return append(clone(xs),ys)};range=function range(start=null,end=null,step=null){return ((step=__oak_js_default(step,1)),__oak_if(end,[[()=>(null),()=>(([start,end=null]=[0,start]))]]),__oak_if(__oak_eq(step,0),[[()=>(true),()=>([])],[()=>(__Oak_Empty),()=>((()=>{ let list;let sub;(list=[]);__oak_if((step>0),[[()=>(true),()=>(sub=function sub(n=null){return (()=>{ let __oak_trampolined_sub;(__oak_trampolined_sub=function(n=null){return __oak_if((n<end),[[()=>(true),()=>((__oak_push(list,n),__oak_trampoline(__oak_trampolined_sub,__as_oak_string(n+step))))],[()=>(__Oak_Empty),()=>(list)]])});return __oak_resolve_trampoline(__oak_trampolined_sub,n) })()})],[()=>(__Oak_Empty),()=>(sub=function sub(n=null){return (()=>{ let __oak_trampolined_sub;(__oak_trampolined_sub=function(n=null){return __oak_if((n>end),[[()=>(true),()=>((__oak_push(list,n),__oak_trampoline(__oak_trampolined_sub,__as_oak_string(n+step))))],[()=>(__Oak_Empty),()=>(list)]])});return __oak_resolve_trampoline(__oak_trampolined_sub,n) })()})]]);return sub(start) })())]]))};reverse=function reverse(xs=null){return (()=>{ let sub;sub=function sub(acc=null,i=null){return (()=>{ let __oak_trampolined_sub;(__oak_trampolined_sub=function(acc=null,i=null){return __oak_if((i<0),[[()=>(true),()=>(acc)],[()=>(__Oak_Empty),()=>(__oak_trampoline(__oak_trampolined_sub,__oak_push(acc,(()=>{let __oak_acc_trgt=__as_oak_string(xs);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(i)])||null:(__oak_acc_trgt[(i)]!==undefined?__oak_acc_trgt[(i)]:null)})()),(i-1)))]])});return __oak_resolve_trampoline(__oak_trampolined_sub,acc,i) })()};return sub(_baseIterator(xs),(len(xs)-1)) })()};map=function map(xs=null,f=null){return (()=>{ let sub;sub=function sub(acc=null,i=null){return (()=>{ let __oak_trampolined_sub;(__oak_trampolined_sub=function(acc=null,i=null){return __oak_if(i,[[()=>(len(xs)),()=>(acc)],[()=>(__Oak_Empty),()=>(__oak_trampoline(__oak_trampolined_sub,__oak_push(acc,f((()=>{let __oak_acc_trgt=__as_oak_string(xs);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(i)])||null:(__oak_acc_trgt[(i)]!==undefined?__oak_acc_trgt[(i)]:null)})(),i)),__as_oak_string(i+1)))]])});return __oak_resolve_trampoline(__oak_trampolined_sub,acc,i) })()};return sub(_baseIterator(xs),0) })()};each=function each(xs=null,f=null){return (()=>{ let sub;sub=function sub(i=null){return (()=>{ let __oak_trampolined_sub;(__oak_trampolined_sub=function(i=null){return __oak_if(i,[[()=>(len(xs)),()=>(null)],[()=>(__Oak_Empty),()=>((f((()=>{let __oak_acc_trgt=__as_oak_string(xs);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(i)])||null:(__oak_acc_trgt[(i)]!==undefined?__oak_acc_trgt[(i)]:null)})(),i),__oak_trampoline(__oak_trampolined_sub,__as_oak_string(i+1))))]])});return __oak_resolve_trampoline(__oak_trampolined_sub,i) })()};return sub(0) })()};filter=function filter(xs=null,f=null){return (()=>{ let sub;sub=function sub(acc=null,i=null){return (()=>{ let __oak_trampolined_sub;(__oak_trampolined_sub=function(acc=null,i=null){return __oak_if(i,[[()=>(len(xs)),()=>(acc)],[()=>(__Oak_Empty),()=>((()=>{ let x;__oak_if(f((x=(()=>{let __oak_acc_trgt=__as_oak_string(xs);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(i)])||null:(__oak_acc_trgt[(i)]!==undefined?__oak_acc_trgt[(i)]:null)})()),i),[[()=>(true),()=>(__oak_push(acc,x))]]);return __oak_trampoline(__oak_trampolined_sub,acc,__as_oak_string(i+1)) })())]])});return __oak_resolve_trampoline(__oak_trampolined_sub,acc,i) })()};return sub(_baseIterator(xs),0) })()};reduce=function reduce(xs=null,seed=null,f=null){return (()=>{ let sub;sub=function sub(acc=null,i=null){return (()=>{ let __oak_trampolined_sub;(__oak_trampolined_sub=function(acc=null,i=null){return __oak_if(i,[[()=>(len(xs)),()=>(acc)],[()=>(__Oak_Empty),()=>(__oak_trampoline(__oak_trampolined_sub,f(acc,(()=>{let __oak_acc_trgt=__as_oak_string(xs);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(i)])||null:(__oak_acc_trgt[(i)]!==undefined?__oak_acc_trgt[(i)]:null)})(),i),__as_oak_string(i+1)))]])});return __oak_resolve_trampoline(__oak_trampolined_sub,acc,i) })()};return sub(seed,0) })()};flatten=function flatten(xs=null){return reduce(xs,[],append)};some=function some(xs=null,pred=null){return ((pred=__oak_js_default(pred,identity)),reduce(xs,false,function(acc=null,x=null){return __oak_or(acc,pred(x))}))};every=function every(xs=null,pred=null){return ((pred=__oak_js_default(pred,identity)),reduce(xs,true,function(acc=null,x=null){return __oak_and(acc,pred(x))}))};zip=function zip(xs=null,ys=null,zipper=null){return (()=>{ let max;let sub;(zipper=__oak_js_default(zipper,function(x=null,y=null){return [x,y]}));(max=__oak_if((len(xs)<len(ys)),[[()=>(true),()=>(len(xs))],[()=>(__Oak_Empty),()=>(len(ys))]]));sub=function sub(acc=null,i=null){return (()=>{ let __oak_trampolined_sub;(__oak_trampolined_sub=function(acc=null,i=null){return __oak_if(i,[[()=>(max),()=>(acc)],[()=>(__Oak_Empty),()=>(__oak_trampoline(__oak_trampolined_sub,__oak_push(acc,zipper((()=>{let __oak_acc_trgt=__as_oak_string(xs);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(i)])||null:(__oak_acc_trgt[(i)]!==undefined?__oak_acc_trgt[(i)]:null)})(),(()=>{let __oak_acc_trgt=__as_oak_string(ys);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(i)])||null:(__oak_acc_trgt[(i)]!==undefined?__oak_acc_trgt[(i)]:null)})())),__as_oak_string(i+1)))]])});return __oak_resolve_trampoline(__oak_trampolined_sub,acc,i) })()};return sub([],0) })()};partition=function partition(xs=null,by=null){return __oak_if(type(by),[[()=>(Symbol.for('int')),()=>(reduce(xs,[],function(acc=null,x=null,i=null){return __oak_if((i%by),[[()=>(0),()=>(__oak_push(acc,[x]))],[()=>(__Oak_Empty),()=>((__oak_push((()=>{let __oak_acc_trgt=__as_oak_string(acc);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[((len(acc)-1))])||null:(__oak_acc_trgt[((len(acc)-1))]!==undefined?__oak_acc_trgt[((len(acc)-1))]:null)})(),x),acc))]])}))],[()=>(Symbol.for('function')),()=>((()=>{ let last;(last=function(){return null});return reduce(xs,[],function(acc=null,x=null){return (()=>{ let __oak_js_this;__oak_if((__oak_js_this=by(x)),[[()=>(last),()=>(__oak_push((()=>{let __oak_acc_trgt=__as_oak_string(acc);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[((len(acc)-1))])||null:(__oak_acc_trgt[((len(acc)-1))]!==undefined?__oak_acc_trgt[((len(acc)-1))]:null)})(),x))],[()=>(__Oak_Empty),()=>(__oak_push(acc,[x]))]]);(last=__oak_js_this);return acc })()}) })())]])};uniq=function uniq(xs=null,pred=null){return (()=>{ let last;let sub;let ys;(pred=__oak_js_default(pred,identity));(ys=[]);(last=function(){return null});sub=function sub(i=null){let p;let x;return (()=>{ let __oak_trampolined_sub;(__oak_trampolined_sub=function(i=null){let p;let x;return __oak_if(i,[[()=>(len(xs)),()=>(ys)],[()=>(__Oak_Empty),()=>(__oak_if((p=pred((x=(()=>{let __oak_acc_trgt=__as_oak_string(xs);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(i)])||null:(__oak_acc_trgt[(i)]!==undefined?__oak_acc_trgt[(i)]:null)})()))),[[()=>(last),()=>(__oak_trampoline(__oak_trampolined_sub,__as_oak_string(i+1)))],[()=>(__Oak_Empty),()=>((__oak_push(ys,x),(last=p),__oak_trampoline(__oak_trampolined_sub,__as_oak_string(i+1))))]]))]])});return __oak_resolve_trampoline(__oak_trampolined_sub,i) })()};return sub(0) })()};find=function find(xs=null,pred=null){return (()=>{ let sub;sub=function sub(i=null){return (()=>{ let __oak_trampolined_sub;(__oak_trampolined_sub=function(i=null){return __oak_if(i,[[()=>(len(xs)),()=>(-1)],[()=>(__Oak_Empty),()=>(__oak_if(pred((()=>{let __oak_acc_trgt=__as_oak_string(xs);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(i)])||null:(__oak_acc_trgt[(i)]!==undefined?__oak_acc_trgt[(i)]:null)})()),[[()=>(true),()=>(i)],[()=>(__Oak_Empty),()=>(__oak_trampoline(__oak_trampolined_sub,__as_oak_string(i+1)))]]))]])});return __oak_resolve_trampoline(__oak_trampolined_sub,i) })()};return sub(0) })()};indexOf=function indexOf(xs=null,x=null){return (()=>{ let sub;sub=function sub(i=null){return (()=>{ let __oak_trampolined_sub;(__oak_trampolined_sub=function(i=null){return __oak_if(i,[[()=>(len(xs)),()=>(-1)],[()=>(__Oak_Empty),()=>(__oak_if((()=>{let __oak_acc_trgt=__as_oak_string(xs);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(i)])||null:(__oak_acc_trgt[(i)]!==undefined?__oak_acc_trgt[(i)]:null)})(),[[()=>(x),()=>(i)],[()=>(__Oak_Empty),()=>(__oak_trampoline(__oak_trampolined_sub,__as_oak_string(i+1)))]]))]])});return __oak_resolve_trampoline(__oak_trampolined_sub,i) })()};return sub(0) })()};contains__oak_qm=function contains__oak_qm(xs=null,x=null){return (indexOf(xs,x)>-1)};values=function values(obj=null){return map(keys(obj),function(key=null){return (()=>{let __oak_acc_trgt=__as_oak_string(obj);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(key)])||null:(__oak_acc_trgt[(key)]!==undefined?__oak_acc_trgt[(key)]:null)})()})};entries=function entries(obj=null){return map(keys(obj),function(key=null){return [key,(()=>{let __oak_acc_trgt=__as_oak_string(obj);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(key)])||null:(__oak_acc_trgt[(key)]!==undefined?__oak_acc_trgt[(key)]:null)})()]})};merge=function merge(...os){return __oak_if(len(os),[[()=>(0),()=>(null)],[()=>(__Oak_Empty),()=>(reduce(os,(()=>{let __oak_acc_trgt=__as_oak_string(os);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[0])||null:(__oak_acc_trgt[0]!==undefined?__oak_acc_trgt[0]:null)})(),function(acc=null,o=null){return (reduce(keys(o),acc,function(root=null,k=null){return (()=>{let __oak_assgn_trgt=__as_oak_string(root);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign((k),(()=>{let __oak_acc_trgt=__as_oak_string(o);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(k)])||null:(__oak_acc_trgt[(k)]!==undefined?__oak_acc_trgt[(k)]:null)})()):((__oak_assgn_trgt[(k)])=(()=>{let __oak_acc_trgt=__as_oak_string(o);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[(k)])||null:(__oak_acc_trgt[(k)]!==undefined?__oak_acc_trgt[(k)]:null)})());return __oak_assgn_trgt})()}))}))]])};once=function once(f=null){return (()=>{ let called__oak_qm;(called__oak_qm=false);return function(...args){return __oak_if(true,[[()=>(called__oak_qm),()=>(null)],[()=>(__Oak_Empty),()=>(((called__oak_qm=true),f(...args)))]])} })()};loop=function loop(max=null,f=null){return (()=>{ let breaker;let broken;let sub;__oak_if(f,[[()=>(null),()=>(((f=max),(max=-1)))]]);(max=__oak_js_default(max,-1));(broken=false);breaker=function breaker(){return (broken=true)};sub=function sub(count=null){return (()=>{ let __oak_trampolined_sub;(__oak_trampolined_sub=function(count=null){return __oak_if(count,[[()=>(max),()=>(null)],[()=>(__Oak_Empty),()=>(__oak_if(broken,[[()=>(true),()=>(null)],[()=>(__Oak_Empty),()=>((f(count,breaker),__oak_trampoline(__oak_trampolined_sub,__as_oak_string(count+1))))]]))]])});return __oak_resolve_trampoline(__oak_trampolined_sub,count) })()};return sub(0) })()};debounce=function debounce(duration=null,firstCall=null,f=null){return (()=>{ let dargs;let debounced;let target;let waiting__oak_qm;__oak_if(f,[[()=>(null),()=>(([firstCall,f=null]=[Symbol.for('trailing'),firstCall]))]]);(dargs=null);(waiting__oak_qm=false);(target=(time()-duration));return debounced=function debounced(...args){return (()=>{ let tcall;(tcall=time());(dargs=args);return __oak_if(waiting__oak_qm,[[()=>(false),()=>(__oak_if((target<=tcall),[[()=>(true),()=>(((target=__as_oak_string(tcall+duration)),__oak_if(firstCall,[[()=>(Symbol.for('leading')),()=>(f(...dargs))],[()=>(Symbol.for('trailing')),()=>(((waiting__oak_qm=true),wait((target-time()),function(){return ((waiting__oak_qm=false),f(...dargs))})))]])))],[()=>(__Oak_Empty),()=>((()=>{ let timeout;(waiting__oak_qm=true);(timeout=(target-tcall));(target=__as_oak_string(target+duration));return wait(timeout,function(){return ((waiting__oak_qm=false),f(...dargs))}) })())]]))]]) })()} })()};println=function println(...xs){return __oak_if(len(xs),[[()=>(0),()=>(print(__Oak_String(`
`)))],[()=>(__Oak_Empty),()=>((()=>{ let out;(out=reduce(slice(xs,1),string((()=>{let __oak_acc_trgt=__as_oak_string(xs);return __is_oak_string(__oak_acc_trgt)?__as_oak_string(__oak_acc_trgt.valueOf()[0])||null:(__oak_acc_trgt[0]!==undefined?__oak_acc_trgt[0]:null)})()),function(acc=null,x=null){return (__as_oak_string(__as_oak_string(acc+__Oak_String(` `))+string(x)))}));return print(__as_oak_string(out+__Oak_String(`
`))) })())]])};(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(_baseIterator,_baseIterator):((__oak_assgn_trgt._baseIterator)=_baseIterator);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(_hToN,_hToN):((__oak_assgn_trgt._hToN)=_hToN);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(_nToH,_nToH):((__oak_assgn_trgt._nToH)=_nToH);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(append,append):((__oak_assgn_trgt.append)=append);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(clamp,clamp):((__oak_assgn_trgt.clamp)=clamp);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(clone,clone):((__oak_assgn_trgt.clone)=clone);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(contains__oak_qm,contains__oak_qm):((__oak_assgn_trgt.contains__oak_qm)=contains__oak_qm);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(debounce,debounce):((__oak_assgn_trgt.debounce)=debounce);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(__oak_js_default,__oak_js_default):((__oak_assgn_trgt.__oak_js_default)=__oak_js_default);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(each,each):((__oak_assgn_trgt.each)=each);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(entries,entries):((__oak_assgn_trgt.entries)=entries);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(every,every):((__oak_assgn_trgt.every)=every);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(filter,filter):((__oak_assgn_trgt.filter)=filter);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(find,find):((__oak_assgn_trgt.find)=find);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(flatten,flatten):((__oak_assgn_trgt.flatten)=flatten);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(fromHex,fromHex):((__oak_assgn_trgt.fromHex)=fromHex);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(identity,identity):((__oak_assgn_trgt.identity)=identity);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(indexOf,indexOf):((__oak_assgn_trgt.indexOf)=indexOf);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(join,join):((__oak_assgn_trgt.join)=join);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(loop,loop):((__oak_assgn_trgt.loop)=loop);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(map,map):((__oak_assgn_trgt.map)=map);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(merge,merge):((__oak_assgn_trgt.merge)=merge);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(once,once):((__oak_assgn_trgt.once)=once);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(partition,partition):((__oak_assgn_trgt.partition)=partition);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(println,println):((__oak_assgn_trgt.println)=println);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(range,range):((__oak_assgn_trgt.range)=range);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(reduce,reduce):((__oak_assgn_trgt.reduce)=reduce);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(reverse,reverse):((__oak_assgn_trgt.reverse)=reverse);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(slice,slice):((__oak_assgn_trgt.slice)=slice);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(some,some):((__oak_assgn_trgt.some)=some);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(toHex,toHex):((__oak_assgn_trgt.toHex)=toHex);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(uniq,uniq):((__oak_assgn_trgt.uniq)=uniq);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(values,values):((__oak_assgn_trgt.values)=values);return __oak_assgn_trgt})();(()=>{let __oak_assgn_trgt=__as_oak_string(__module);__is_oak_string(__oak_assgn_trgt)?__oak_assgn_trgt.assign(zip,zip):((__oak_assgn_trgt.zip)=zip);return __oak_assgn_trgt})();return __module })()}),__oak_modularize(__Oak_String(`str`),function(){return (()=>{ let __module;let _extend;let _matchesAt__oak_qm;let _replaceNonEmpty;let _splitNonEmpty;let _trimEndNonEmpty;let _trimSpace;let _trimStartNonEmpty;let checkRange;let contains__oak_qm;let __oak_js_default;let digit__oak_qm;let endsWith__oak_qm;let indexOf;let join;let letter__oak_qm;let lower;let lower__oak_qm;let map;let padEnd;let padStart;let reduce;let replace;let slice;let space__oak_qm;let split;let startsWith__oak_qm;let trim;let trimEnd;let trimStart;let upper;let upper__oak_qm;let word__oak_qm;(__module={});({__oak_js_default:__oak_js_default=null,map:map=null,slice:slice=null,reduce:reduce=null}=__oak_module_import(__Oak_String(`std`)));checkRange=function checkRange(lo=null,hi=null){let checker;return checker=function checker(c=null){return (()=>{ let p;(p=codepoint(c));return __oak_and((lo<=p),(p<=hi)) })()}};(upper__oak_qm=checkRange(codepoint(__Oak_String(`A`)),codepoint(__Oak_String(`Z`))));(lower__oak_qm=checkRange(codepoint(__Oak_String(`a`)),codepoint(__Oak_String(`z`))));(digit__oak_qm=checkRange(codepoint(__Oak_String(`0`)),codepoint(__Oak_String(`9`))));(space__oak_qm=function(c=null){return __oak_if(c,[[()=>(__Oak_String(` `)),()=>(true)],[()=>(__Oak_String(`	`)),()=>(true)],[()=>(__Oak_String(`
`)),()=>(true)],[()=>(__Oak_String(`