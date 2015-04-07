var ArrayType;
var primitives;

var inherit = require('raptor-util/inherit');
var Model;
var EMPTY_ATTRIBUTES = {};

function _get(model, property) {
    var getter = property.getGetter();
    if (getter) {
        return getter.call(model, property);
    }

    var value = model.data[property.getProperty()];
    if (value == null) {
        return value;
    }

    var type = property.getType();
    if (type.isWrapped()) {
        if (type.isAutoUnwrapped()) {
            // auto unwrap
            value = Model.unwrap(value);
        } else {
            // make sure we return an instance of the actual type and not the raw value
            value = property.getType().wrap(value);
        }
    }

    return value;
}

function _set(model, property, value, options) {
    var Type = property.getType();

    if (Model.isModel(value) && (value instanceof Type)) {
        // value is expected type
        // store raw data in this model's data
        value = value.data;
    } else if (Type.coerce) {

        options = _toOptions(options);
        options.property = property;

        value = Type.coerce.call(Type, value, options);

        options.property = undefined;
    }

    var setter = property.getSetter();
    if (setter) {
        return setter.call(model, property.getProperty(), value, property);
    }

    if ((value != null) && Type.isWrapped()) {
        // recursively call setters
        Type.wrap(value, options);
    }

    model.data[property.getProperty()] = Model.unwrap(value);
}

function _generateGetter(property) {
    return function () {
        return _get(this, property);
    };
}

function _generateSetter(property) {
    return function(value) {
        return _set(this, property, value);
    };
}

function _initialUpperCase(str) {
    return str.charAt(0).toUpperCase() + str.substring(1);
}

module.exports = Model = function Model(data, options) {
    var Derived = this.constructor;

    if (Derived.constructable === false) {
        throw new Error('Instances of this type cannot be created. data: ' + data);
    }

    if (Derived.hasProperties()) {
        var properties = Derived.properties;
        this.data = data || {};
        if (data != null) {
            var errors;
            if (options) {
                if (Array.isArray(options)) {
                    // since options is an array we treat as the output array
                    // for errors
                    options = {
                        errors: (errors = options)
                    };
                } else {
                    errors = options.errors;
                }
            }

            // use setters to make sure values get properly coerced
            for (var key in data) {
                if ((key.charAt(0) !== '$') && data.hasOwnProperty(key)) {

                    var property = properties[key];
                    if (property) {
                        _set(this, property, data[key], options);
                    } else if (!Derived.additionalProperties && errors) {
                        errors.push('Unrecognized property: ' + key);
                    }
                }
            }
        }
        this.data.$model = this;
    } else {
        this.data = data;
    }
};

Model.isModel = function(obj) {
    return obj && obj.Model;
};

Model.unwrap = function(obj) {
    if (obj == null) {
        return obj;
    }

    if (obj.Model) {
        return obj.data;
    }

    return obj;
};

function _clean(obj, errors) {
    if ((obj = Model.unwrap(obj)) == null) {
        return obj;
    }

    if (obj.$model) {
        return obj.$model.clean(errors);
    }

    return obj;
}

Model.clean = function(obj, errors) {
    if (Array.isArray(obj)) {
        var result = new Array(obj.length);
        var i = obj.length;
        while(--i >= 0) {
            result[i] = Model.clean(obj[i], errors);
        }
        return result;
    } else {
        return _clean(obj, errors);
    }
};

Model.hasProperties = function() {
    return this.properties !== EMPTY_ATTRIBUTES;
};

Model.hasProperty = function(propertyName) {
    return !!this.properties[propertyName];
};

Model.getProperties = function() {
    return this.properties;
};

Model.getProperty = function(propertyName) {
    return this.properties[propertyName];
};

Model.forEachProperty = function(callback) {
    var proto = this.Properties.prototype;
    do {
        for (var key in proto) {
            if (proto.hasOwnProperty(key)) {
                var property = proto[key];
                if (property.constructor === Property) {
                    if (key === property.getName()) {
                        callback(property);
                    }
                }
            }
        }
    } while((proto = Object.getPrototypeOf(proto)) != null);
};

Model.preventConstruction = function() {
    this.constructable = false;
};

Model.isCompatibleWith = function(other) {
    var cur = this;
    do {
        if (cur === other) {
            return true;
        }
    } while((cur = (cur.$super)));
    return false;
};

Model.coercionError = function(value, options) {
    var message = '';
    if (options && options.property && options.property.getName) {
        message += options.property.getName() + ': ';
    }
    message += 'Invalid value: ' + value;

    if (options && options.errors) {
        options.errors.push(message);
    } else {
        var err = new Error(message);
        err.source = Model;
        throw err;
    }
};

function _jsonStringifyReplacer(key, value) {
    if (key.charAt(0) === '$') {
        return undefined;
    }

    if (value != null) {
        if (Model.isModel(value)) {
            return Model.unwrap(value);
        }
    }

    return value;
}

Model.stringify = function(obj, pretty) {
    return JSON.stringify(obj, _jsonStringifyReplacer, pretty ? '    ' : undefined);
};

var Model_proto = Model.prototype;

Model_proto.unwrap = function() {
    return this.data;
};

/**
 * Creates a deep clone of the data stored in this object with all temporary
 * and non-persisted values removed.
 */
Model_proto.clean = function(errors) {
    var data = this.data;

    var Derived = this.constructor;
    var properties = Derived.properties;

    if (Derived.hasProperties()) {
        var clone = {};
        for (var key in data) {
            if ((key.charAt(0) !== '$') && data.hasOwnProperty(key)) {
                var property = properties[key];
                var value = data[key];
                if (property && (property.isPersisted())) {
                    clone[key] = Model.clean(value, errors);
                } else if (!Derived.additionalProperties && errors) {
                    errors.push('Unrecognized property: ' + key);
                }
            }
        }
        return clone;
    } else {
        return data;
    }
};

Model_proto.set = function(propertyName, value, errors) {
    var properties = this.constructor.properties;
    _set(this, properties[propertyName], value, errors);
};

Model_proto.get = function(propertyName) {
    var properties = this.constructor.properties;
    return _get(this, properties[propertyName]);
};

Model_proto.stringify = function(pretty) {
    return Model.stringify(this.data, pretty);
};

Model_proto.toJSON = function() {
    return this.clean();
};

function Property(config) {
    for (var key in config) {
        if (config.hasOwnProperty(key)) {
            this[key] = config[key];
        }
    }
}

var Property_proto = Property.prototype;

Property_proto.getName = function() {
    return this.name;
};

Property_proto.getProperty = function() {
    return this.property;
};

Property_proto.getType = function() {
    return this.type;
};

Property_proto.getItems = function() {
    return this.items;
};

Property_proto.getGetter = function() {
    return this.get;
};

Property_proto.getSetter = function() {
    return this.set;
};

Property_proto.isPersisted = function() {
    return (this.persist !== false);
};

function Items(owner) {
    this.owner = owner;
}

Items.prototype.getName = function() {
    return this.owner.getName();
};

var Property_proto = Items.prototype;

Property_proto.getName = function() {
    return this.name;
};

function _parseType(type) {
    if (type.Model) {
        // type is derived from Model
        return type;
    }

    switch(type) {
    case Date:
        return primitives.date;
    case Number:
        return primitives.number;
    case Boolean:
        return primitives.boolean;
    case String:
        return primitives.string;
    case Object:
        return primitives.object;
    case Array:
        return ArrayType;
    }

    throw new Error('Unrecognized type. Expected type derived from Model or primitive type.');
}

function _parseTypeStr(typeStr, propertyConfig, resolver) {
    var len = typeStr.length;
    if ((typeStr.charAt(len - 2) === '[') && (typeStr.charAt(len - 1) === ']')) {
        // array type
        propertyConfig.type = ArrayType;
        propertyConfig.items = {};
        _parseTypeStr(typeStr.substring(0, len - 2), propertyConfig.items, resolver);
    } else {
        propertyConfig.type = _resolve(typeStr, resolver);
    }
}

function _resolve(typeName, resolver) {
    var type = primitives[typeName];
    if (type) {
        return type;
    }

    if (resolver) {
        if ((type = resolver(typeName))) {
            return type;
        }
    }

    throw new Error('Invalid type: ' + typeName);
}

function _parseTypeConfig(propertyConfig, resolver) {
    if (Array.isArray(propertyConfig)) {
        propertyConfig = {
            type: propertyConfig
        };
    } else if ((typeof propertyConfig) !== 'object') {
        propertyConfig = {
            type: propertyConfig
        };
    }

    var type = propertyConfig.type;
    if (type) {
        if (Array.isArray(type)) {
            // handle short-hand notation for Array types
            propertyConfig.type =  ArrayType;
            if (type.length) {
                var items = type[0];
                if (items != null) {
                    propertyConfig.items = _parseTypeConfig(items, resolver);
                }
            }
        } else if (type.constructor === String) {
            _parseTypeStr(type, propertyConfig, resolver);
        } else {
            // handle normal notation for types
            propertyConfig.type = _parseType(type);

            // Convert the subtype to special type if necessary
            if (propertyConfig.items) {
                propertyConfig.items = _parseTypeConfig(propertyConfig.items, resolver);
            }
        }
    } else {
        propertyConfig.type = primitives.object;
    }

    return propertyConfig;
}

function _toProperty(name, propertyConfig, resolver) {
    propertyConfig = _parseTypeConfig(propertyConfig, resolver);
    propertyConfig.name = name;
    propertyConfig.property = propertyConfig.property || name;

    return new Property(propertyConfig);
}

var SPECIAL_PROPERTIES = {
    init: 1,
    wrap: 1,
    unwrap: 1,
    autoUnwrap: 1,
    coerce: 1,
    properties: 1,
    prototype: 1
};

function _copyNonSpecialPropertiesToType(config, Type) {
    for (var key in config) {
        if (config.hasOwnProperty(key) && !SPECIAL_PROPERTIES[key]) {
            Type[key] = config[key];
        }
    }
}

function _toOptions(options) {
    if (options == null) {
        return {};
    }

    if (Array.isArray(options)) {
        return {
            errors: options
        };
    }

    return options;
}

function _extend(Base, config, resolver) {
    config = config || {};

    var init = config.init;
    var wrap = config.wrap;
    var unwrap = config.unwrap;
    var autoUnwrap = !!config.autoUnwrap;
    var coerce = config.coerce;
    var properties = config.properties;
    var prototype = config.prototype;

    function Derived(data, options) {
        Derived.$super.call(this, data, options);
        if (init) {
            init.call(this, data, options);
        }
    }

    _copyNonSpecialPropertiesToType(config, Derived);

    // Selectively copy properties from Model to Derived
    [
        'getProperty',
        'getProperties',
        'hasProperty',
        'hasProperties',
        'preventConstruction',
        'unwrap',
        'coercionError',
        'forEachProperty',
        'isCompatibleWith'
    ].forEach(function(property) {
        Derived[property] = Model[property];
    });

    // Store reference to Model
    Derived.Model = Model;

    if (coerce) {
        Derived.coerce = function(value, options) {
            return coerce.call(Derived, value, _toOptions(options));
        };
    }

    // provide method to extend this model
    Derived.extend = function(config) {
        return _extend(Derived, config);
    };

    Derived.isWrapped = function() {
        return (wrap !== false);
    };

    Derived.isAutoUnwrapped = function() {
        return autoUnwrap;
    };

    var factory;
    if (wrap && wrap.constructor === Function) {
        factory = wrap;
    } else {
        factory = function(data, options) {
            if (arguments.length === 0) {
                return new Derived();
            }

            if (data instanceof Derived) {
                return data;
            }

            if (coerce) {
                options = _toOptions(options);
                data = coerce.call(Derived, data, options);
            }

            if (data == null) {
                return data;
            }

            if (Model.isModel(data)) {
                if (data instanceof Derived) {
                    return data;
                } else {
                    data = Model.unwrap(data);
                    delete data.$model;
                }
            }

            if (wrap === false) {
                return data;
            }

            if (Array.isArray(data)) {
                // TODO: Handle wrapping Array?
                // If so, replace items or return new Array?
                throw new Error('Wrapping Array object is not allowed.');
            }

            // return existing model or create a new model
            // NOTE: Model constructor will store $model in data
            return (data && data.$model) || new Derived(data, options);
        };
    }

    Derived.create = Derived.wrap = factory;

    inherit(Derived, Base);

    var classPrototype = Derived.prototype;
    classPrototype.Model = Derived;

    if (unwrap) {
        classPrototype.unwrap = unwrap;
    }

    var propertyNames;
    if (properties && (propertyNames = Object.keys(properties)).length > 0) {
        // Use prototype chaining to create property map
        Derived.Properties = function() {};

        if (Base.Properties) {
            inherit(Derived.Properties, Base.Properties);
        }

        if (properties) {
            var propertiesPrototype = Derived.Properties.prototype;
            propertyNames.forEach(function(name) {
                var property = _toProperty(name, properties[name], resolver);
                var propertyName = property.getProperty();

                // Put the properties in the prototype by name and property
                propertiesPrototype[name] = property;
                if (name !== propertyName) {
                    propertiesPrototype[propertyName] = property;
                }

                var funcName;
                var funcSuffix = _initialUpperCase(name);


                if (property.getGetter() !== null) {
                    funcName = 'get' + funcSuffix;
                    classPrototype[funcName] = _generateGetter(property);
                }

                if (property.getSetter() !== null) {
                    funcName = 'set' + funcSuffix;
                    classPrototype[funcName] = _generateSetter(property);
                }
            });
        }

        Derived.properties = new Derived.Properties();

    } else {
        Derived.Properties = Base.Properties;
        Derived.properties = Base.properties || EMPTY_ATTRIBUTES;
    }

    if (prototype) {
        Object.keys(prototype).forEach(function(key) {
            classPrototype[key] = prototype[key];
        });
    }

    return Derived;
}

Model.extend = function(config, resolver) {
    return _extend(Model, config, resolver);
};

primitives = require('./primitives');
ArrayType = primitives.array;
