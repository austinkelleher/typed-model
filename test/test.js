var chai = require('chai');
chai.config.includeStack = true;
require('chai').should();
var expect = require('chai').expect;

var Model = require('../Model');
var Enum = require('../Enum');
var DateType = require('../Date');

var Gender = Enum.create({
	values: ['M', 'F'],
	autoUpperCase: true
});

var Address = Model.extend({
    properties: {
        'city': String,
        'state': String
    }
});

var Member = Model.extend({
    properties: {
		email: String,
        dateCreated: Date,
        displayName: String,
        gender: Gender,
        address: Address
    }
});

describe('Model' , function() {
    it('should provide metadata', function() {
        var Person = Model.extend({
            properties: {
                dateOfBirth: Date
            }
        });

        var DerivedPerson = Person.extend({
        });

        var Stub = Model.extend({
        });

        var DerivedStub = Stub.extend({
            properties: {
                name: String
            }
        });

        var Simple = Stub.extend({
            properties: {}
        });

        var ToString = Model.extend({
            wrap: false,
            coerce: function(value) {
                return (value == null) ? value : value.toString();
            }
        });

        expect(Person.hasProperties()).to.equal(true);
        expect(Person.isWrapped()).to.equal(true);

        expect(DerivedPerson.hasProperties()).to.equal(true);
        expect(DerivedPerson.isWrapped()).to.equal(true);

        expect(Stub.hasProperties()).to.equal(false);
        expect(Stub.isWrapped()).to.equal(true);

        expect(DerivedStub.hasProperties()).to.equal(true);
        expect(DerivedStub.isWrapped()).to.equal(true);

        expect(Simple.hasProperties()).to.equal(false);
        expect(Simple.isWrapped()).to.equal(true);

        expect(ToString.hasProperties()).to.equal(false);
        expect(ToString.isWrapped()).to.equal(false);
    });

    it('should handle Date type', function() {
		var date = DateType.coerce('1980-02-01T05:00:00.000Z');
		expect(date).to.deep.equal(new Date(1980, 1, 1));

		expect(function() {
			DateType.coerce(true);
		}).to.throw();

        var Person = Model.extend({
            properties: {
                dateOfBirth: Date
            }
        });

        var person = new Person();
        expect(person.Model.properties.dateOfBirth.getName()).to.equal('dateOfBirth');
        person.setDateOfBirth(new Date(1980, 1, 1));
        expect(person.getDateOfBirth()).to.deep.equal(new Date(1980, 1, 1));
    });

    it('should provide setters', function() {
        var Person = Model.extend({
            properties: {
                name: String,
                dateOfBirth: Date
            }
        });

        var person = new Person();
        person.setName('John Doe');
        person.setDateOfBirth(new Date(1980, 1, 1));

        expect(person.getName()).to.equal('John Doe');
        expect(person.getDateOfBirth()).to.deep.equal(new Date(1980, 1, 1));



        var rawPerson = person.unwrap();
        expect(rawPerson.name).to.equal('John Doe');
        expect(rawPerson.dateOfBirth).to.deep.equal(new Date(1980, 1, 1));
    });

    it('should allow wrapping existing', function() {
        var Person = Model.extend({
            properties: {
                name: String,
                dateOfBirth: Date
            }
        });

        var rawPerson = {
            name: 'John Doe',
            dateOfBirth: new Date(1980, 1, 1)
        };

        var person = new Person(rawPerson);
        person.setName('Jane Doe');

        // raw person should also reflect any changes
        expect(rawPerson.name).to.equal('Jane Doe');
        expect(rawPerson.dateOfBirth).to.deep.equal(new Date(1980, 1, 1));
    });

    it('should allow custom property names', function() {
        var Entity = Model.extend({
            properties: {
                id: {
                    type: String,
                    property: '_id'
                }
            }
        });

        var Person = Entity.extend({
            properties: {
                name: String,
                dateOfBirth: Date
            }
        });

        var person = new Person({
            _id: 'test',
            name: 'John Doe',
            dateOfBirth: new Date(1980, 1, 1)
        });

        expect(person.getId()).to.equal('test');
    });

    it('should support type coercion', function() {
        var NumericId = Model.extend({
            wrap: false,
            coerce: function(value) {
                if (value != null && value.constructor !== Number) {
                    value = Number(value.toString());
                }
                return value;
            }
        });

        var Product = Model.extend({
            properties: {
                id: NumericId
            }
        });

        var product = new Product({
            id: '123'
        });

        expect(product.getId()).to.equal(123);
    });

    it('should allow stringify', function() {
        var member = new Member({
            email: 'jane.doe@example.com',
            displayName: 'Jane',
            address: {
                city: 'Durham',
                state: 'NC'
            }
        });

        expect(member.stringify()).to.equal(JSON.stringify({
            email: 'jane.doe@example.com',
            displayName: 'Jane',
            address: {
                city: 'Durham',
                state: 'NC'
            }
        }));
    });

    it('should properly stringify an array of models', function() {
        var Person = Model.extend({
            properties: {
                name: String
            }
        });

        var people = [
            Person.wrap({
                name: 'John'
            }),
            Person.wrap({
                name: 'Sally'
            })
        ];

        expect(Model.stringify(people)).to.equal(JSON.stringify([
            {
                name: 'John'
            },
            {
                name: 'Sally'
            }
        ]));
    });

    it('should allow efficient wrapping and unwrapping', function() {
        var Person = Model.extend({
            properties: {
                name: String
            }
        });

        var rawPerson = {
            name: 'John'
        };

        expect(Person.hasProperties()).to.equal(true);

        var person = Person.wrap(rawPerson);

        // unwrap person to get the original raw object
        expect(Model.unwrap(person)).to.equal(rawPerson);

        // if you have the raw object then wrapping it will return
        // the existing wrapper (and not create a new object)
        expect(Person.wrap(rawPerson)).to.equal(person);
    });

    it('should allow cleaning of "hidden" model properties from raw data', function() {
        var Entity = Model.extend({
            properties: {
                id: {
                    type: String,
                    property: '_id'
                }
            }
        });

        var Address = Model.extend({
            properties: {
                city: String,
                state: String
            }
        });

        var Person = Entity.extend({
            properties: {
                name: String,
                dateOfBirth: Date,
                address: Address
            }
        });

        var person = new Person({
            _id: 'test',
            name: 'John Doe',
            dateOfBirth: new Date(1980, 1, 1),
            address: new Address({
                city: 'Durham',
                state: 'NC'
            })
        });

        expect(Model.clean(person)).to.deep.equal({
            _id: 'test',
            name: 'John Doe',
            dateOfBirth: new Date(1980, 1, 1),
            address: {
                city: 'Durham',
                state: 'NC'
            }
        });
    });

    it('should allow enum type models', function() {
		expect(Gender.wrap('F').isF()).to.equal(true);

        var Person = Model.extend({
            properties: {
                gender: Gender
            }
        });

        expect(function() {
            (new Gender('X')).toString();
        }).to.throw(Error);

		expect(Gender.M.name()).to.equal('M');
        expect(Gender.F.name()).to.equal('F');
        expect(Gender.M.value()).to.equal('M');
        expect(Gender.F.value()).to.equal('F');

        expect(Gender.M.isM()).to.equal(true);
        expect(Gender.M.isF()).to.equal(false);

        expect(Gender.F.isM()).to.equal(false);
        expect(Gender.F.isF()).to.equal(true);

        var person1 = new Person({
            gender: 'F'
        });

        //expect(person1.data.gender).to.equal

        expect(person1.getGender().isF()).to.equal(true);

        var person2 = new Person();
        person2.setGender('M');

        expect(person2.getGender().isM()).to.equal(true);
        expect(person2.getGender().isF()).to.equal(false);
    });

	it('should allow enum object values', function() {

		var Color = Enum.create({
			values: {
				red: {
					hex: '#FF0000',
					name: 'Red'
				},

				green: {
					hex: '#00FF00',
					name: 'Green'
				},

				blue: {
					hex: '#0000FF',
					name: 'Blue'
				}
			}
		});

		expect(Color.RED.name()).to.equal('red');
		expect(Color.GREEN.name()).to.equal('green');
		expect(Color.BLUE.name()).to.equal('blue');

		expect(Color.RED.value().hex).to.equal('#FF0000');
		expect(Color.RED.value().name).to.equal('Red');

		expect(Color.GREEN.value().hex).to.equal('#00FF00');
		expect(Color.GREEN.value().name).to.equal('Green');

		expect(Color.BLUE.value().hex).to.equal('#0000FF');
		expect(Color.BLUE.value().name).to.equal('Blue');

		expect(Color.red.value().hex).to.equal('#FF0000');
		expect(Color.red.value().name).to.equal('Red');

		expect(Color.green.value().hex).to.equal('#00FF00');
		expect(Color.green.value().name).to.equal('Green');

		expect(Color.blue.value().hex).to.equal('#0000FF');
		expect(Color.blue.value().name).to.equal('Blue');
    });

	it('should allow unwrapping an enum', function() {

		var Color = Enum.create({
			values: ['red', 'green', 'blue']
		});

		var Person = Model.extend({
			properties: {
				favoriteColor: Color
			}
		});


		var person = new Person();
		person.setFavoriteColor(Color.BLUE);

		expect(person.unwrap().favoriteColor).to.equal('blue');
    });

	it('should allow setting an enum object value', function() {

		var Color = Enum.create({
			values: {
				red: {
					hex: '#FF0000',
					name: 'Red'
				},

				green: {
					hex: '#00FF00',
					name: 'Green'
				},

				blue: {
					hex: '#0000FF',
					name: 'Blue'
				}
			}
		});

		var Person = Model.extend({
			properties: {
				favoriteColor: Color
			}
		});


		var person = new Person();
		person.setFavoriteColor(Color.BLUE);

		expect(person.unwrap().favoriteColor.hex).to.equal('#0000FF');
    });

    it('should allow opaque wrapper type', function() {
        var Token = Model.extend({});

        var token = new Token({
            a: 1,
            b: 2
        });

        expect(token.data).to.deep.equal({
            a: 1,
            b: 2
        });

        var raw = token.unwrap();

        expect(raw.a).to.equal(1);
        expect(raw.b).to.equal(2);

        expect(token.clean()).to.deep.equal({
            a: 1,
            b: 2
        });
    });

	it('should support simplified array type', function() {

		var Color = Enum.create({
			values: ['red', 'green', 'blue']
		});

		expect(Color.RED.clean()).to.equal('red');
		expect(Color.RED.value()).to.equal('red');
		expect(Color.RED.toString()).to.equal('red');

        var ColorPalette = Model.extend({
			properties: {
				colors: [Color]
			}
		});

		var colorPalette = new ColorPalette({
			colors: ['red', 'green', 'blue']
		});

		var colors = [];
		colorPalette.getColors().forEach(function(color, index) {
			color = Color.wrap(color);
			expect(color.constructor).to.equal(Color);
			colors[index] = color;
		});

		expect(colors.length).to.equal(3);
		expect(colors[0]).to.equal(Color.RED);
		expect(colors[1]).to.equal(Color.GREEN);
		expect(colors[2]).to.equal(Color.BLUE);

		expect(Color.wrap(colorPalette.getColors()[0])).to.equal(Color.RED);
		expect(Color.wrap(colorPalette.getColors()[1])).to.equal(Color.GREEN);
		expect(Color.wrap(colorPalette.getColors()[2])).to.equal(Color.BLUE);
    });

	it('should handle enum conversion errors', function() {
		var Color = Enum.create({
			values: ['red', 'green', 'blue']
		});

		expect(function() {
			try {
				Color.coerce('yellow');
			} catch(e) {
				expect(e.source).to.equal(Model);
				throw e;
			}
		}).to.throw(Error);

		var errors;

		errors = [];
		// "yellow" is not a valid color
		Color.coerce('yellow', errors);
		expect(errors.length).to.equal(1);

		var Shirt = Model.extend({
			properties: {
				color: Color
			}
		});

		var Person = Model.extend({
			properties: {
				shirt: Shirt
			}
		});

		errors = [];
		var person = new Person({
			shirt: {
				// "pink" is not a valid color
				color: 'pink'
			}
		}, errors);


		expect(errors.length).to.equal(1);

		errors = [];

		// Manually add unrecognized property
		person.data.blah = true;

		var rawPerson = person.clean(errors);
		expect(errors.length).to.equal(1);

		// color will be undefined since it is invalid
		expect(rawPerson).to.deep.equal({
			shirt: {
				color: undefined
			}
		});
    });

	it('should coerce Number primitive type', function() {
		var Person = Model.extend({
			properties: {
				age: Number
			}
		});

		var person = new Person();
		person.setAge('10');
		expect(person.getAge()).to.equal(10);

		expect(function() {
			person.setAge('asdfsadf');
		}).to.throw(Error);
	});

	it('should coerce Boolean primitive type', function() {
		var Person = Model.extend({
			properties: {
				happy: Boolean
			}
		});

		var person = new Person();
		person.setHappy(1);
		expect(person.getHappy()).to.equal(true);

		person.setHappy(0);
		expect(person.getHappy()).to.equal(false);

		person.setHappy();
		expect(person.getHappy()).to.equal(undefined);

		person.setHappy(null);
		expect(person.getHappy()).to.equal(null);
	});

	it('should coerce String primitive type', function() {
		var Person = Model.extend({
			properties: {
				message: String
			}
		});

		var person = new Person();

		person.setMessage(true);
		expect(person.getMessage()).to.equal('true');

		person.setMessage('Hello');
		expect(person.getMessage()).to.equal('Hello');

		person.setMessage(new Date(0));
		expect(person.getMessage()).to.equal('Wed Dec 31 1969 19:00:00 GMT-0500 (EST)');

		person.setMessage(42);
		expect(person.getMessage()).to.equal('42');

		person.setMessage(0);
		expect(person.getMessage()).to.equal('0');

		person.setMessage();
		expect(person.getMessage()).to.equal(undefined);

		person.setMessage(null);
		expect(person.getMessage()).to.equal(null);
	});

	it('should coerce array of primitives', function() {
		var Something = Model.extend({
			properties: {
				arrayOfBooleans: [Boolean]
			}
		});

		var something = Something.wrap({
			arrayOfBooleans: [0, 1, 'abc', -1, 'true']
		});

		var arrayOfBooleans = something.getArrayOfBooleans();
		expect(arrayOfBooleans[0]).to.equal(false);
		expect(arrayOfBooleans[1]).to.equal(true);
		expect(arrayOfBooleans[2]).to.equal(false);
		expect(arrayOfBooleans[3]).to.equal(true);
		expect(arrayOfBooleans[4]).to.equal(true);
	});

	it('should coerce array of enums', function() {
		var Color = Enum.create({
			values: ['red', 'green', 'blue']
		});

		var Person = Model.extend({
			properties: {
				favoriteColors: [Color]
			}
		});

		var person = Person.wrap({
			favoriteColors: ['red', 'green', 'blue']
		});

		var favoriteColors = person.getFavoriteColors();
		expect(favoriteColors[0]).to.equal('red');
		expect(favoriteColors[1]).to.equal('green');
		expect(favoriteColors[2]).to.equal('blue');

		expect(function() {
			person = Person.wrap({
				favoriteColors: ['zero']
			});
		}).to.throw(Error);

		var errors = [];
		person = Person.wrap({
			favoriteColors: ['fake']
		}, errors);

		// should capture one error
		expect(errors.length).to.equal(1);
	});

	it('should coerce array of models', function() {
		var Person = Model.extend({
			properties: {
				happy: Boolean
			}
		});

		var Something = Model.extend({
			properties: {
				people: [Person]
			}
		});

		var something = Something.wrap({
			people: [
				{
					happy: 0
				},
				{
					happy: false
				},
				{
					happy: 1
				},
				{
					happy: true
				}
			]
		});

		var people = something.getPeople();
		expect(people[0].happy).to.equal(false);
		expect(people[1].happy).to.equal(false);
		expect(people[2].happy).to.equal(true);
		expect(people[3].happy).to.equal(true);


		expect(Person.wrap(something.getPeople()[0]).getHappy()).to.equal(false);
		expect(Person.wrap(something.getPeople()[1]).getHappy()).to.equal(false);
		expect(Person.wrap(something.getPeople()[2]).getHappy()).to.equal(true);
		expect(Person.wrap(something.getPeople()[3]).getHappy()).to.equal(true);

		var cleanSomething = Model.clean(something);
		expect(cleanSomething).to.deep.equal({
			people: [
				{
					happy: false
				},
				{
					happy: false
				},
				{
					happy: true
				},
				{
					happy: true
				}
			]
		});
	});

	it('should support integer type', function() {
		var IntegerType = require('../Integer');
		var ArrayType = require('../Array');

		var Something = Model.extend({
			properties: {
				first: 'integer',
				second: IntegerType,
				firstArray: ['integer'],
				secondArray: [IntegerType]
			}
		});

		expect(Something.getProperty('first').getType()).to.equal(IntegerType);
		expect(Something.getProperty('second').getType()).to.equal(IntegerType);
		expect(Something.getProperty('firstArray').getType()).to.equal(ArrayType);
		expect(Something.getProperty('secondArray').getType()).to.equal(ArrayType);
		expect(Something.getProperty('firstArray').getItems().type).to.equal(IntegerType);
		expect(Something.getProperty('secondArray').getItems().type).to.equal(IntegerType);
	});

	it('should support complex object validation', function() {
		var IntegerType = require('../Integer');

		var Something = Model.extend({
			properties: {
				name: String,
				age: IntegerType
			}
		});

		var errors;
		var something;

		errors = [];
		something = Something.wrap({
			name: 'John',
			age: 30
		}, errors);
		expect(errors.length).to.equal(0);

		something = Something.wrap({
			name: 'John',
			age: 'blah'
		}, errors);

		expect(errors.length).to.equal(1);

		errors = [];
		something = Something.wrap({
			blah: 'Blah',
		}, errors);
		expect(errors.length).to.equal(1);
	});

	it('should support additionalProperties', function() {
		var IntegerType = require('../Integer');

		var Something = Model.extend({
			properties: {
				name: String,
				age: IntegerType
			},
			additionalProperties: true
		});

		var errors;
		var something;

		errors = [];
		something = Something.wrap({
			blah: 'Blah',
		}, errors);
		expect(errors.length).to.equal(0);
	});

	it('should support strict validation', function() {
		var IntegerType = require('../Integer');

		var Something = Model.extend({
			properties: {
				someString: String,
				someBoolean: Boolean,
				someDate: Date,
				someNumber: Number,
				someInteger: IntegerType
			},
			additionalProperties: true
		});

		var errors = [];

		Something.wrap({
			someString: 123,
			someBoolean: 1,
			someDate: 0,
			someNumber: '123',
			someInteger: '123'
		}, {
			strict: true,
			errors: errors
		});

		expect(errors.length).to.equal(5);
	});

	it('should support array of array type', function() {
		var IntegerType = require('../Integer');
		var Item = Model.extend({
			properties: {
				id: IntegerType
			}
		});

		var Something = Model.extend({
			properties: {
				// short-hand for defining an Array of Array
				stuff: [[Item]],

				// long-hand for defining an Array of Array
				moreStuff: {
					type: Array,
					items: {
						type: Array,
						items: Item
					}
				}
			},
			additionalProperties: true
		});

		var errors;
		var something;

		errors = [];
		something = Something.wrap({
			stuff: [
				[{id: '1'}, {id: '2'}],
				[{id: '3'}, {id: '4'}]
			]
		}, errors);
		expect(errors.length).to.equal(0);

		expect(something.clean()).to.deep.equal({
			stuff: [
				[{id: 1}, {id: 2}],
				[{id: 3}, {id: 4}]
			]
		});
	});

	it('should not wrap and unwrap Model instances if property type is declared as object', function() {
		var Item = Model.extend({
			properties: {
				id: String
			}
		});

		var Something = Model.extend({
			properties: {
				// Use Object as type
				item: Object
			}
		});

		var something = new Something();
		something.setItem(new Item({
			id: 'abc'
		}));

		expect(something.getItem().getId()).to.equal('abc');
	});

	it('should allow Function type', function() {
		var Item = Model.extend({
			properties: {
				handler: Function
			}
		});

		var item;

		expect(function() {
			item = new Item({
				handler: 'abc'
			});
		}).to.throw();

		item = new Item({
			handler: function() {}
		});

		expect(item.getHandler().constructor).to.equal(Function);
	});

	it('should implement isPrimitive', function() {
		var Item = Model.extend({
			properties: {
				handler: Function
			}
		});

		expect(Item.isPrimitive()).to.equal(false);

		var primitives = require('../primitives');

		Object.keys(primitives).forEach(function(name) {
			var Type = primitives[name];
			expect(Type.isPrimitive()).to.equal(true);
		});
	});

	it('should support mixins for types with properties', function() {
		var onCreateCallCount;
		var onSetCallCount;

		function resetCallCounts() {
			onCreateCallCount = 0;
			onSetCallCount = 0;
		}

		resetCallCounts();

		var myMixin = {
			id: 'myMixin',

			onCreate: function(model) {
				onCreateCallCount++;

				var curCount = model.getCount();
				if (curCount === undefined) {
					model.setCount(0);
				} else {
					model.setCount(curCount + 1);
				}
			},

			onSet: function(model, event) {
				onSetCallCount++;
			},

			prototype: {
				incrementCount: function() {
					this.setCount(this.getCount() + 1);
				}
			}
		};

		var BaseItem = Model.extend({
			properties: {
				count: Number
			},
			mixins: [myMixin]
		});

		var DerivedItem = BaseItem.extend({
			properties: {
				count: Number
			},
			mixins: [myMixin]
		});

		expect(DerivedItem._onSet.length).to.equal(1);

		var baseItem = new BaseItem();
		expect(onCreateCallCount).to.equal(1);
		expect(onSetCallCount).to.equal(1);
		expect(baseItem.getCount()).to.equal(0);

		resetCallCounts();

		var derivedItem = new DerivedItem();
		expect(onCreateCallCount).to.equal(1);
		expect(onSetCallCount).to.equal(1);
		expect(derivedItem.getCount()).to.equal(0);

		derivedItem.incrementCount();

		expect(onSetCallCount).to.equal(2);
		expect(derivedItem.getCount()).to.equal(1);
	});

	it('should support mixins for types without properties', function() {
		var onCreateCallCount;

		function resetCallCounts() {
			onCreateCallCount = 0;
		}

		resetCallCounts();

		var myMixin = {
			id: 'myMixin',

			onCreate: function(model) {
				onCreateCallCount++;

				model.count = 0;
			},

			prototype: {
				incrementCount: function() {
					this.count++;
				}
			}
		};

		var BaseSimpleItem = Model.extend({
		});

		var DerivedSimpleItem = BaseSimpleItem.extend({
			mixins: [myMixin]
		});

		var AnotherDerivedSimpleItem = BaseSimpleItem.extend({
			mixins: [myMixin]
		});

		var baseSimpleItem = new BaseSimpleItem();
		expect(baseSimpleItem.incrementCount).to.equal(undefined);
		expect(baseSimpleItem.count).to.equal(undefined);

		var derivedSimpleItem = new DerivedSimpleItem();
		expect(derivedSimpleItem.incrementCount).to.not.equal(undefined);
		expect(derivedSimpleItem.count).to.equal(0);

		var anotherDerivedSimpleItem = new AnotherDerivedSimpleItem();
		expect(anotherDerivedSimpleItem.incrementCount).to.not.equal(undefined);
		expect(anotherDerivedSimpleItem.count).to.equal(0);
	});
});
