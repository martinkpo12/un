var async	= require('async');
var express	= require('express');
var fs		= require('fs');
var util	= require('util');
//var sqlite3	= require('sqlite3').verbose();
var check	= require('validator').check,
    sanitize= require('validator').sanitize;
var Validator = require('validator').Validator;
/* var db = new sqlite3.Database('database.db'); */

var mongoose = require('mongoose');
var db = mongoose.createConnection("mongodb://martin:root@dharma.mongohq.com:10038/enamun");

var paisSchema = mongoose.Schema({
	nombre: String,
	largo: String,
	gobierno: String,
	geografia: String,
	historia: String,
	postura: String,
	religiones: String,
	presidente: String,
	comentarios: [ { por: { type: String, default: "Anonimo" }, contenido: String, fecha: { type: Date, default: Date.now } } ],
	imagen: String
});

var Pais = db.model('Pais', paisSchema);

var docSchema = mongoose.Schema({
	subido: { type: Date, default: Date.now },
	modificado: Date,
	autor: String,
	tema: String,
	comentarios: [ { por: { type: String, default: "Anonimo" }, contenido: String, fecha: { type: Date, default: Date.now } } ]
});

var Documento = db.model('Documento', docSchema);

var fotoSchema = mongoose.Schema({
	subido: { type: Date, default: Date.now },
	titulo: String,
	url: String,
	descripcion: String,
	comentarios: [ { por: { type: String, default: "Anonimo" }, contenido: String, fecha: { type: Date, default: Date.now } } ]
});

var Foto = db.model('Foto', fotoSchema);

var videoSchema = mongoose.Schema({
	subido: { type: Date, default: Date.now },
	titulo: String,
	descripcion: String,
	url: String,
	comentarios: [ { por: { type: String, default: "Anonimo" }, contenido: String, fecha: { type: Date, default: Date.now } } ]
});

var Video = db.model('Video', videoSchema);

var noticiaSchema = mongoose.Schema({
	subido: { type: Date, default: Date.now },
	titulo: String,
	subtitulo: String,
	contenido: String,
	imagen: String,
	comentarios: [ { por: { type: String, default: "Anonimo" }, contenido: String, fecha: { type: Date, default: Date.now } } ]
});

var Noticia = db.model('Noticia', noticiaSchema);



var imgNum = 0;

// create an express webserver
var app = express.createServer(
  express.logger(),
  express.static(__dirname + '/public'),
  express.bodyParser(),
  express.cookieParser(),
  // set this to a secret value to encrypt session cookies
  express.session({ secret: process.env.SESSION_SECRET || 'secret123' }),
  require('faceplate').middleware({
    app_id: '474994785857809',//process.env.FACEBOOK_APP_ID,
    secret: 'db78d461a907e872184eb90c042ee536',//process.env.FACEBOOK_SECRET,
    scope:  'publish_actions, email'
  })
);

// listen to the PORT given to us in the environment
var port = process.env.PORT || 9090;

app.listen(port, function() {
  console.log("Listening on " + port);
});

app.dynamicHelpers({
  'host': function(req, res) {
    return req.headers['host'];
  },
  'scheme': function(req, res) {
    req.headers['x-forwarded-proto'] || 'http'
  },
  'url': function(req, res) {
    return function(path) {
      return app.dynamicViewHelpers.scheme(req, res) + app.dynamicViewHelpers.url_no_scheme(path);
    }
  },
  'url_no_scheme': function(req, res) {
    return function(path) {
      return '://' + app.dynamicViewHelpers.host(req, res) + path;
    }
  },
});

/* Extended */

Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

Validator.prototype.error = function (msg) {
	this._errors.push(msg);
	return this;
}

Validator.prototype.getErrors = function () {
	return this._errors;
}

function pretty_JSON(obj) {
	return "<pre>"+JSON.stringify(obj,null,4)+"</pre>";
}

function pretty_URL(id, type, req) {
	return "<a href='http://" + req.headers['host'] + '/api/' + type + '/' + id + "'>" + id + '</a>';
}

function render_page(req, res) {
	console.log('hola');
	Noticia.find({}).sort( { subido : -1 } ).limit(3).exec( function (err, noticias) {
		Pais.find({}, function (err, paises_) {
			
			var rnd = [];
			var num = Object.size(paises_);
			while (Object.size(rnd) < 3) {
				var i = parseInt(Math.random() * 100) % num;
				while (rnd.indexOf(i) > -1) {
					i = parseInt(Math.random() * 100) % num;
				}
				rnd.push(i);
			}
			
			console.log(rnd);
			
			var paises = [paises_[rnd[0]], paises_[rnd[1]], paises_[rnd[2]]];
			
			Video.find({}).sort( { subido : -1 } ).limit(3).exec( function (err, videos) {
				Foto.find({}).sort( { subido : -1 } ).limit(3).exec( function (err, fotos) {
					res.render('index.ejs', {
						layout:    	false,
						req:       	req,
						countries:	paises,
						videos:		videos,
						fotos:		fotos,
						articulos:	noticias
					});
				});
			});
		});
	});
}

function handle_facebook_request(req, res) {

  // if the user is logged in
  if (req.facebook.token) {

    async.parallel([
      function(cb) {
        // query 4 friends and send them to the socket for this socket id
        req.facebook.get('/me/friends', { limit: 4 }, function(friends) {
          req.friends = friends;
          cb();
        });
      },
      function(cb) {
        // query 16 photos and send them to the socket for this socket id
        req.facebook.get('/me/photos', { limit: 16 }, function(photos) {
          req.photos = photos;
          cb();
        });
      },
      function(cb) {
        // query 4 likes and send them to the socket for this socket id
        req.facebook.get('/me/likes', { limit: 4 }, function(likes) {
          req.likes = likes;
          cb();
        });
      },
      function(cb) {
	      req.facebook.get('/me',function(response) {
		      cb();
	      });
      },
      function(cb) {
        // use fql to get a list of my friends that are using this app
        req.facebook.fql('SELECT uid, name, is_app_user, pic_square FROM user WHERE uid in (SELECT uid2 FROM friend WHERE uid1 = me()) AND is_app_user = 1', function(result) {
          req.friends_using_app = result;
          cb();
        });
      }
    ], function() {
      render_page(req, res);
    });

  } else {
    render_page(req, res);
  }
}

app.get('/', render_page);
app.post('/', render_page);

/*
=================================================
				Views definitions
=================================================


	Countries:
*/

app.get('/paises', function (req,res) {
	
	Pais.find({}, function(err,paises) {
		console.log(err);
		console.log(paises);
		if (!err) {
/* 			req.facebook.app(function(app) { */
/* 				req.facebook.me(function(user) { */
						res.render('paises.ejs', {
						layout:    false,
						req:       req,
						app:       app,
/* 						user:      user, */
						countries: paises
/* 					}); */
/* 				}); */
			});
		}
		else {
			throw err;
		}
	});
	/*

	db.serialize(function() {
		db.all('SELECT * FROM paises ORDER BY name', function(err,rows) {
			req.facebook.app(function(app) {
				req.facebook.me(function(user) {
					res.render('paises.ejs', {
						layout:    false,
						req:       req,
						app:       app,
						user:      user,
						countries: rows
					});
				});
			});
		});
	});
*/
});

app.get('/paises/nuevo', function (req, res) {
/* 	req.facebook.app(function(app) { */
/* /		req.facebook.me(function(user) { */
			res.render('pais.new.ejs', {
				layout:    false,
				req:       req,
				app:       app,
/* 				user:      user */
			});
/* 		}); */
/* 	}); */
});

// Redirect
app.get('/pais', function(req,res){
	res.redirect('/paises');
});

app.get('/pais/:id', function (req,res,next) {

	Pais.findOne( { nombre: req.params.id }, function (err, pais) {
/* 		req.facebook.app(function(app) { */
/* 			req.facebook.me(function(user) { */
				res.render('pais.ejs', {
					layout:    false,
					req:       req,
					app:       app,
/* 					user:      user, */
					country:   pais
				});
/* 			}); */
/* 		}); */
	});

	/*
db.serialize(function() {
		db.get('SELECT * FROM paises WHERE id="' + req.params.id + '" OR name="' + req.params.id + '"',
		function(err,row) {
			if (row == null) {
				next();
/* 				error = {'errno': 1, 'description': 'Pais no existente'}; *
/* 				res.send(pretty_JSON(error)); *
				return;
			}
			req.facebook.app(function(app) {
				req.facebook.me(function(user) {
					res.render('pais.ejs', {
						layout:    false,
						req:       req,
						app:       app,
						user:      user,
						country:   row
					});
				});
			});
		});
	});
*/
});

app.get('/pais/:id/edit', function (req, res, next) {
	
	Pais.findOne({ nombre: req.params.id }, function (err, pais) {
/* 		req.facebook.app(function(app) { */
/* 			req.facebook.me(function(user) { */
				res.render('pais.edit.ejs', {
					layout:    false,
					req:       req,
					app:       app,
/* 					user:      user, */
					country:   pais
				});
/* 			}); */
/* 		}); */
	});

	/*db.serialize(function() {
		db.get('SELECT * FROM paises WHERE id="' + req.params.id + '" OR name="' + req.params.id + '"',
		function(err,row) {
			if (row == null) {
				next();
/* 				error = {'errno': 1, 'description': 'Pais no existente'}; *
/* 				res.send(pretty_JSON(error)); *
				return;
			}
			req.facebook.app(function(app) {
				req.facebook.me(function(user) {
					res.render('pais.edit.ejs', {
						layout:    false,
						req:       req,
						app:       app,
						user:      user,
						country:   row
					});
				});
			});
		});
	});*/
});

// Noticias API

app.get('/noticias/nueva', function (req, res) {
	//console.log(req);
/* 	req.facebook.app(function(app) { */
/* 		req.facebook.me(function(user) { */
			res.render('noticia.new.ejs', {
				layout:    false,
				req:       req,
				app:       app,
/* 				user:      user */
			});
/* 		}); */
/* 	}); */
});

app.get('/noticias/:page', function (req,res) {
	
	news_per_page = 5;
	var query = Noticia.find({}),
	count = Noticia.find({}).count( function (err, count) {
		if (err) console.log(err);
		else {
			console.log([count]);
			news_count = count;
		}
	});
	query.sort({subido: -1}).skip((req.params.page-1)*news_per_page).limit(news_per_page).exec( function (err, noticias) {
/* 		req.facebook.app(function(app) { */
/* 			req.facebook.me(function(user) { */
				res.render('noticias.ejs', {
					layout:    false,
					req:       req,
					app:       app,
/* 					user:      user, */
					articulos: noticias,
					count:	   Math.ceil(news_count / news_per_page)
				});
/* 			}); */
/* 		}); */
	});
	/*Noticia.find(function (err, noticias) {
		req.facebook.app(function(app) {
			req.facebook.me(function(user) {
				res.render('noticias.ejs', {
					layout:    false,
					req:       req,
					app:       app,
					user:      user,
					articulos: noticias
				});
			});
		});
	}).skip((req.params.page-1)*3).limit(3);*/
	
	/*
db.serialize(function() {
		db.all('SELECT * FROM articulos', function(err,rows) {
			req.facebook.app(function(app) {
				req.facebook.me(function(user) {
					res.render('noticias.ejs', {
						layout:    false,
						req:       req,
						app:       app,
						user:      user,
						articulos: rows
					});
				});
			});
		});
	});
*/
});

// Redirect
app.get('/noticia', function (req,res) {
	res.redirect('/noticias');
});
app.get('/noticias', function (req, res) {
	res.redirect('/noticias/1');
});

app.get('/noticia/:id', function (req,res) {
	
	Noticia.findById(req.params.id, function (err, noticia) {
		if (err) res.send(pretty_JSON(err));
/* 		req.facebook.app(function(app) { */
/* 			req.facebook.me(function(user) { */
				console.log(noticia);
				res.render('noticia.ejs', {
					layout:    false,
					req:       req,
					app:       app,
/* 					user:      user, */
					noticia:   noticia
				});
/* 			}); */
/* 		}); */
	});
	
	/*
db.serialize(function() {
		db.get('SELECT * FROM articulos WHERE id="' + req.params.id + '" OR titulo="' + req.params.id + '"',
		function(err,row) {
			req.facebook.app(function(app) {
				req.facebook.me(function(user) {
					console.log(row);
					res.render('noticia.ejs', {
						layout:    false,
						req:       req,
						app:       app,
						user:      user,
						noticia:  row
					});
				});
			});
		});
	});
*/
	
});

app.get('/noticia/:id/edit', function (req, res, next) {

	Noticia.findById(req.params.id, function (err, noticia) {
/* 		req.facebook.app(function(app) { */
/* 			req.facebook.me(function(user) { */
				res.render('noticia.edit.ejs', {
					layout:    false,
					req:       req,
					app:       app,
/* 					user:      user, */
					articulo:  noticia
				});
/* 			}); */
/* 		}); */
	})
	/*db.serialize(function() {
		db.get('SELECT * FROM articulos WHERE id="' + req.params.id + '" OR titulo="' + req.params.id + '"',
		function(err,row) {
			if (row == null) {
				next();
/* 				error = {'errno': 1, 'description': 'Pais no existente'}; *
/* 				res.send(pretty_JSON(error)); *
				return;
			}
			req.facebook.app(function(app) {
				req.facebook.me(function(user) {
					res.render('noticia.edit.ejs', {
						layout:    false,
						req:       req,
						app:       app,
						user:      user,
						articulo:  row
					});
				});
			});
		});
	});*/
});

// Videos API

app.get('/videos', function (req,res) {
	
	Video.find({}, function (err, videos) {
		if (err) console.log(err);
		else {
/* 			req.facebook.app(function(app) { */
/* 				req.facebook.me(function(user) { */
					res.render('videos.ejs', {
						layout:    false,
						req:       req,
						app:       app,
/* 						user:      user, */
						videos:	   videos
					});
/* 				}); */
/* 			}); */
		}
	});
	
	/*db.serialize(function() {
		db.all('SELECT * FROM videos', function(err,rows) {
			req.facebook.app(function(app) {
				req.facebook.me(function(user) {
					res.render('videos.ejs', {
						layout:    false,
						req:       req,
						app:       app,
						user:      user,
						videos:	   rows
					});
				});
			});
		});
	});*/
});

app.get('/videos/nuevo', function (req, res) {
/* 	req.facebook.app(function(app) { */
/* 		req.facebook.me(function(user) { */
			res.render('video.new.ejs', {
				layout:    false,
				req:       req,
				app:       app,
/* 				user:      user */
			});
/* 		}); */
/* 	}); */
});

// Redirect
app.get('/video', function (req,res) {
	res.redirect('/videos');
});
app.get('/video/nuevo', function (req,res) {
	res.redirect('/videos/nuevo');
});

app.get('/video/:id', function (req,res) {
	
	Video.findById(req.params.id, function (err, video) {
		console.log(video);
/* 		req.facebook.app(function(app) { */
/* 			req.facebook.me(function(user) { */
				res.render('video.ejs', {
					layout:    false,
					req:       req,
					app:       app,
/* 					user:      user, */
					video:	   video
				});
/* 			}); */
/* 		}); */
	});
	
	/*db.serialize(function() {
		db.get('SELECT * FROM videos WHERE id="' + req.params.id + '" OR name="' + req.params.id + '"',
		function(err,row) {
			req.facebook.app(function(app) {
				req.facebook.me(function(user) {
					console.log(row);
					res.render('video.ejs', {
						layout:    false,
						req:       req,
						app:       app,
						user:      user,
						video:	   row
					});
				});
			});
		});
	});*/
	
});

app.get('/video/:id/edit', function (req, res, next) {
	
	Video.findById(req.params.id, function (err, video) {
/* 		req.facebook.app(function(app) { */
/* 			req.facebook.me(function(user) { */
				res.render('video.edit.ejs', {
					layout:    false,
					req:       req,
					app:       app,
/* 					user:      user, */
					video:	   video
				});
/* 			}); */
/* 		}); */
	});
	
	/*db.serialize(function() {
		db.get('SELECT * FROM videos WHERE id="' + req.params.id + '" OR name="' + req.params.id + '"',
		function(err,row) {
			if (row == null) {
				next();
/* 				error = {'errno': 1, 'description': 'Pais no existente'}; *
/* 				res.send(pretty_JSON(error)); *
				return;
			}
			req.facebook.app(function(app) {
				req.facebook.me(function(user) {
					res.render('video.edit.ejs', {
						layout:    false,
						req:       req,
						app:       app,
						user:      user,
						video:	   row
					});
				});
			});
		});
	});*/
});

// Fotos API

app.get('/fotos', function (req,res) {
	
	Foto.find({}, function (err, fotos) {
		if (err) throw err;
/* 		req.facebook.app(function(app) { */
/* 			req.facebook.me(function(user) { */
				res.render('fotos.ejs', {
					layout:    false,
					req:       req,
					app:       app,
/* 					user:      user, */
					fotos:	   fotos
				});
/* 			}); */
/* 		}); */
	});
	
	/*
db.serialize(function() {
		db.all('SELECT * FROM fotos', function(err,rows) {
			req.facebook.app(function(app) {
				req.facebook.me(function(user) {
					res.render('fotos.ejs', {
						layout:    false,
						req:       req,
						app:       app,
						user:      user,
						fotos:	   rows
					});
				});
			});
		});
	});
*/
});

app.get('/fotos/nueva', function (req, res) {
	req.facebook.app(function(app) {
		req.facebook.me(function(user) {
			res.render('foto.new.ejs', {
				layout:    false,
				req:       req,
				app:       app,
				user:      user
			});
		});
	});
});

// Redirect
app.get('/foto', function (req,res) {
	res.redirect('/fotos');
});

app.get('/foto/:id', function (req,res) {

	Foto.findById(req.params.id, function (err, foto) {
		if (err) res.send(err);
		else {
			console.log(foto);
/* 			req.facebook.app(function(app) { */
/* 				req.facebook.me(function(user) { */
					res.render('foto.ejs', {
						layout:    false,
						req:       req,
						app:       app,
/* 						user:      user, */
						foto:	   foto
					});
/* 				}); */
/* 			}); */
		}
	});
	
	/*db.serialize(function() {
		db.get('SELECT * FROM fotos WHERE id="' + req.params.id + '" OR name="' + req.params.id + '"',
		function(err,row) {
			req.facebook.app(function(app) {
				req.facebook.me(function(user) {
					console.log(row);
					res.render('foto.ejs', {
						layout:    false,
						req:       req,
						app:       app,
						user:      user,
						foto:	   row
					});
				});
			});
		});
	});*/
	
});

app.get('/foto/:id/edit', function (req, res, next) {
	
	Foto.findById(req.params.id, function (err, foto) {
		if (err) res.send(err);
		else {
			console.log(foto);
/* 			req.facebook.app(function(app) { */
/* 				req.facebook.me(function(user) { */
					res.render('foto.edit.ejs', {
						layout:    false,
						req:       req,
						app:       app,
/* 						user:      user, */
						foto:	   foto
					});
/* 				}); */
/* 			}); */
		}
	});

	/*db.serialize(function() {
		db.get('SELECT * FROM fotos WHERE id="' + req.params.id + '" OR name="' + req.params.id + '"',
		function(err,row) {
			if (row == null) {
				next();
/* 				error = {'errno': 1, 'description': 'Pais no existente'}; *
/* 				res.send(pretty_JSON(error)); *
				return;
			}
			req.facebook.app(function(app) {
				req.facebook.me(function(user) {
					res.render('foto.edit.ejs', {
						layout:    false,
						req:       req,
						app:       app,
						user:      user,
						foto:	   row
					});
				});
			});
		});
	});*/
});

/* Users */

app.get('/users', function () {
	db.serialize(function () {
		db.all("SELECT * FROM users",
		function (err, rows) {
			res.send(rows);
		});
	});
});

app.get('/user', function (req,res) {
	res.redirect('/users');
});

app.get('/user/:id', function () {
	db.serialize(function () {
		db.get("SELECT * FROM users WHERE id=" + req.params.id,
		function (err, row) {
			res.send(row);
		});
	});
});

app.get('/user/:id/:col', function () {
	db.serialize(function () {
		db.get("SELECT " + req.params.col + " FROM users WHERE id=" + req.params.id,
		function (err, row) {
			res.send(row);
		});
	});
});


app.get('/game', function(req, res) {
	
	res.render('game.ejs', {
		layout:    false,
		req:       req
	});
});

app.get('/modelos', function(req, res) {
	
/* 	req.facebook.app(function(app) { */
/* 		req.facebook.me(function(user) { */
			res.render('modelos.ejs', {
				layout:    false,
				req:       req,
/* 				app:       app, */
/* 				user:      user, */
			});
/* 		}); */
/* 	}); */
});

/*
=================================================
				API definitions
=================================================


	Countries:
*/

app.get('/api/paises', function (req, res) {
	
	Pais.find({}, function (err, paises) {
		if (!err)
			res.send(pretty_JSON(paises));
		else
			throw err;
	});
	
	/*
db.serialize(function() {
		db.all('SELECT * FROM paises',
		function(err,rows) {
			res.send(pretty_JSON(rows));
		});
	});
*/
});

// Redirect
app.get('/api/pais', function(req, res) {
	res.redirect('/api/paises');
});

app.post('/api/paises', function (req, res) {
	
	console.log(req.body);
	
	var pais = Pais(req.body);
	
	pais.save(function (err) {
		console.log(err);
		if (err) throw err;
		else res.send(pretty_JSON(pais));
	});
	
	/*db.serialize(function () {
		
		var validator = new Validator();
		
		validator.check(req.body.name, "El pais debe contener un nombre").notNull();
		validator.check(req.body.description, "La descripción esta vacia").notNull();
		validator.check(req.body.description, "La descripción es muy corta").len(50);
		
		sanitize(req.body.description).xss();
		
		var sql = "INSERT INTO paises (name,flag_url,description) VALUES ($name,$furl,$desc)";
		
		var flagurl;
		
		if (Object.size(req.files) == 0) {
			flagurl = req.body.flagurl;
			validator.check(flagurl, "La URL de la bandera esta vacia").notNull();
			validator.check(flagurl, "La URL de la bandera debe tener formato de URL").isUrl();
			runDB();
		}
		else {
			fs.readFile(req.files.flag_image.path, function (err, data) {
				// ...
				var name = req.files.flag_image.name;
				var i = name.lastIndexOf('.');
				var newPath = __dirname + "/public/static/images/"+imgNum+((i < 0) ? '' : name.substr(i));
				console.log(newPath);
				fs.writeFile(newPath, data, function (err) {
					if (err) {
						res.send(pretty_JSON(err));
					}
					else {
						flagurl = '/static/images/'+imgNum+((i < 0) ? '' : name.substr(i));
						console.log(flagurl);
						imgNum++;
						runDB();
					}
				});
			});
		}
		
		function runDB() {
			var errors = validator.getErrors();
			if (errors.length != 0) {
				res.send(pretty_JSON({ status: 'VALIDATION_ERROR', errors: errors}));
				return;
			}
			db.run(sql,
			{
				$name: req.body.name,
				$furl: flagurl,
				$desc: req.body.description
			},
			function (err) {
				if (err) {
					res.send(pretty_JSON({ status: 'SERVER_ERROR', error: err }));
				}
				else {
					res.send(pretty_JSON({status: 'OK', id: pretty_URL(this.lastID, 'pais', req), changes: this.changes}));
				}
			});
		}
		
	});*/
});

app.get('/api/pais/:id', function (req, res) {
	
	db.serialize(function() {
		db.get('SELECT * FROM paises WHERE id="' + req.params.id + '" OR name="' + req.params.id + '"',
		function(err,row) {
			if (row == null) {
				error = {'errno': 1, 'description': 'Pais no existente'};
				res.send(pretty_JSON(error));
				return;
			}
			res.send(pretty_JSON(row));
		});
	});
});

// Redirect
app.get('/api/paises/:id', function(req, res) {
	res.redirect('/api/pais/' + req.params.id);
});

app.put('/api/pais/:id', function (req, res) {
	
	Pais.findOneAndUpdate({ nombre: req.params.id}, req.body, function (err, pais) {
		if (err) res.send(pretty_JSON(err));
		else res.send(pretty_JSON(pais));
	});
	
	/*

	db.serialize(function () {
		
		var sql = "UPDATE paises SET ";
		var keys = Object.keys(req.body);
		
		for (i = 0; i < keys.length; i++) {
			sql += keys[i] + '="' + req.body[keys[i]];
			sql += (i == keys.length - 1) ? '" ' : '", ';
		}
		
		sql += "WHERE id='" + req.params.id + "' OR name='" + req.params.id + "'";
		
		db.run(sql, function (err) {
			if (err)
				res.send(pretty_JSON(err));
			else
				res.send(pretty_JSON({
					id: pretty_URL((req.body.name === null) ? req.params.id : req.body.name, 'pais' ,req),
					changes: this.changes
				})
			);
		});
	});
*/
});

app.delete('/api/pais/:id', function (req, res) {
	Pais.findOneAndRemove( { nombre: req.params.id }, function (err, p) {
		if (err) res.send(pretty_JSON(err));
		else res.send(pretty_JSON(p));
	});

	/*
	db.serialize(function () {
		db.run('DELETE FROM paises WHERE id=$id',
			{ $id: req.params.id },
			function (err) {
				if (err)
					res.send(pretty_JSON(err));
				else
					res.send(pretty_JSON({ status: 'OK' }));
			});
	});*/
});

app.post('/api/pais/:id/addComment', function (req, res) {
	
	Pais.findOneAndUpdate(
		{ nombre: req.params.id},
		{"$push": {comentarios: req.body }},
		function (err, pais) {
		if (err) res.send(pretty_JSON(err));
		else res.send(pretty_JSON(pais));
	});
});

/*

	News:
*/

app.get('/api/noticias', function (req, res) {
	
	db.serialize(function() {
		db.all('SELECT * FROM articulos',
		function(err,rows) {
			res.send(pretty_JSON(rows));
		});
	});
});

app.post('/api/noticias', function (req, res) {
	
	
	
	console.log(req.files);
	
	if (Object.size(req.files) == 1) {
		
		console.log(newPath);
		var newPath = __dirname + "/public/static/images/"+req.files.imagen.name;
		fs.readFile(req.files.imagen.path, function (err, data) {
			fs.writeFile(newPath, data, function (err) {
				if (err) {
					res.send(pretty_JSON(err));
				}
				else {
					req.body["imagen"] = '/static/images/'+req.files.imagen.name;
	/* 				flagurl = '/static/images/'+req.files.imagen.name; */
					console.log(req.body);
					
					var noticia = Noticia(req.body);
					
					noticia.save(function (err) {
						console.log(err);
						if (err) res.send(pretty_JSON(err));
						else res.send(pretty_JSON(noticia));
					});
				}
			});
		});
	} else {
		var noticia = Noticia(req.body);
		
		noticia.save(function (err) {
			console.log(err);
			if (err) res.send(pretty_JSON(err));
			else res.send(pretty_JSON(noticia));
		});
	}
	
	
	/*
db.serialize(function () {
		
		var validator = new Validator();
		
		validator.check(req.body.name, "La noticia debe contener un nombre").notNull();
		validator.check(req.body.description, "La descripción esta vacia").notNull();
		validator.check(req.body.description, "La descripción es muy corta").len(15);
		
		sanitize(req.body.description).xss();
		
		var sql = "INSERT INTO videos (name,url,description) VALUES ($name,$furl,$desc)";
		
		var flagurl;
		
		if (Object.size(req.files) == 0) {
			flagurl = req.body.flagurl;
			validator.check(flagurl, "La URL esta vacia").notNull();
			validator.check(flagurl, "La URL debe tener formato de URL").isUrl();
			runDB();
		}
		else {
			fs.readFile(req.files.video_url.path, function (err, data) {
				// ...
				var name = req.files.video_url.name;
				var i = name.lastIndexOf('.');
				var newPath = __dirname + "/public/static/videos/"+imgNum+((i < 0) ? '' : name.substr(i));
				console.log(newPath);
				fs.writeFile(newPath, data, function (err) {
					if (err) {
						res.send(pretty_JSON(err));
					}
					else {
						flagurl = '/static/videos/'+imgNum+((i < 0) ? '' : name.substr(i));
						console.log(flagurl);
						imgNum++;
						runDB();
					}
				});
			});
		}
		
		function runDB() {
			var errors = validator.getErrors();
			if (errors.length != 0) {
				res.send(pretty_JSON({ status: 'VALIDATION_ERROR', errors: errors}));
				return;
			}
			db.run(sql,
			{
				$name: req.body.name,
				$furl: flagurl,
				$desc: req.body.description
			},
			function (err) {
				if (err) {
					res.send(pretty_JSON({ status: 'SERVER_ERROR', error: err }));
				}
				else {
					res.send(pretty_JSON({status: 'OK', id: pretty_URL(this.lastID, 'noticia', req), changes: this.changes}));
				}
			});
		}
		
	});
*/
});

// Redirect
app.get('/api/noticia', function(req, res) {
	res.redirect('/api/noticias');
});

app.get('/api/noticia/:id', function (req, res) {
	
	db.serialize(function() {
		db.get('SELECT * FROM articulos WHERE id="' + req.params.id + '" OR name="' + req.params.id + '"',
		function(err,row) {
			if (row == null) {
				error = {'errno': 1, 'description': 'Noticia no existente'};
				res.send(pretty_JSON(error));
				return;
			}
			res.send(pretty_JSON(row));
		});
	});
});

app.put('/api/noticia/:id', function (req, res) {
	
	console.log(req.body);
	
	Noticia.findByIdAndUpdate(req.params.id, req.body, function (err, pais) {
		if (err) res.send(pretty_JSON(err));
		else res.send(pretty_JSON(pais));
	});
	
	/*db.serialize(function () {
		
		var sql = "UPDATE articulos SET ";
		var keys = Object.keys(req.body);
		
		for (i = 0; i < keys.length; i++) {
			sql += keys[i] + '="' + req.body[keys[i]];
			sql += (i == keys.length - 1) ? '" ' : '", ';
		}
		
		sql += "WHERE id='" + req.params.id + "' OR name='" + req.params.id + "'";
		
		db.run(sql, function (err) {
			if (err)
				res.send(pretty_JSON(err));
			else
				res.send(pretty_JSON({
					id: pretty_URL((req.body.name === null) ? req.params.id : req.body.name, 'noticia' ,req),
					changes: this.changes
				})
			);
		});
	});*/

});

app.delete('/api/noticia/:id', function (req, res) {

	Noticia.findByIdAndRemove( req.params.id, function (err, p) {
		if (err) res.send(pretty_JSON(err));
		else res.send(pretty_JSON(p));
	});

	/*db.serialize(function () {
		if (req.body.url != 'none') {
			fs.unlink(__dirname + '/public' + req.body.url, function (err) {
				if (err) throw err;
				console.log('Successfully deleted the video');
			});
		}
		db.run('DELETE FROM articulos WHERE id=$id',
			{ $id: req.params.id },
			function (err) {
				if (err)
					res.send(pretty_JSON(err));
				else
					res.send(pretty_JSON({ status: 'OK' }));
			});
	});*/
});

app.get('/api/noticia/:id/:col', function (req, res) {
	
	db.serialize(function() {
		db.get('SELECT ' + req.params.col + ' FROM articulos WHERE id="' + req.params.id + '" OR name="' + req.params.id + '"',
		function(err,row) {
			if (err) {
				if (err['errno'] == 1) {
					err['description'] = 'Atributo no existente';
				}
				res.send(pretty_JSON(err));
				return;
			}
			res.send(pretty_JSON(row));
		});
	});
});

app.post('/api/noticia/:id/addComment', function (req, res) {
	
	Noticia.findByIdAndUpdate(
		req.params.id,
		{"$push": {comentarios: req.body }},
		function (err, pais) {
		if (err) res.send(pretty_JSON(err));
		else res.send(pretty_JSON(pais));
	});
});

/*

	Videos:
*/

app.get('/api/videos', function (req, res) {
	
	db.serialize(function() {
		db.all('SELECT * FROM videos',
		function(err,rows) {
			res.send(pretty_JSON(rows));
		});
	});
});

app.post('/api/videos', function (req, res) {
	
	/*var video = Video(req.body);
	
	video.save(function (err) {
		console.log(err);
		if (err) res.send(pretty_JSON(err));
		else res.send(pretty_JSON(video));
	});*/
	
	if (Object.size(req.files) == 1) {
		
		console.log(newPath);
		var newPath = __dirname + "/public/static/videos/"+req.files.url.name;
		fs.readFile(req.files.url.path, function (err, data) {
			fs.writeFile(newPath, data, function (err) {
				if (err) {
					res.send(pretty_JSON(err));
				}
				else {
					req.body["url"] = '/static/videos/'+req.files.url.name;
	/* 				flagurl = '/static/images/'+req.files.imagen.name; */
					console.log(req.body);
					
					var video = Video(req.body);
					
					video.save(function (err) {
						console.log(err);
						if (err) res.send(pretty_JSON(err));
						else res.send(pretty_JSON(video));
					});
				}
			});
		});
	} else {
		var video = Video(req.body);
		
		video.save(function (err) {
			console.log(err);
			if (err) res.send(pretty_JSON(err));
			else res.send(pretty_JSON(video));
		});
	}
	
	/*
db.serialize(function () {
		
		var validator = new Validator();
		
		validator.check(req.body.name, "El video debe contener un nombre").notNull();
		validator.check(req.body.description, "La descripción esta vacia").notNull();
		validator.check(req.body.description, "La descripción es muy corta").len(15);
		
		sanitize(req.body.description).xss();
		
		var sql = "INSERT INTO videos (name,url,description) VALUES ($name,$furl,$desc)";
		
		var flagurl;
		
		if (Object.size(req.files) == 0) {
			flagurl = req.body.flagurl;
			validator.check(flagurl, "La URL esta vacia").notNull();
			validator.check(flagurl, "La URL debe tener formato de URL").isUrl();
			runDB();
		}
		else {
			fs.readFile(req.files.video_url.path, function (err, data) {
				// ...
				var name = req.files.video_url.name;
				var i = name.lastIndexOf('.');
				var newPath = __dirname + "/public/static/videos/"+imgNum+((i < 0) ? '' : name.substr(i));
				console.log(newPath);
				fs.writeFile(newPath, data, function (err) {
					if (err) {
						res.send(pretty_JSON(err));
					}
					else {
						flagurl = '/static/videos/'+imgNum+((i < 0) ? '' : name.substr(i));
						console.log(flagurl);
						imgNum++;
						runDB();
					}
				});
			});
		}
		
		function runDB() {
			var errors = validator.getErrors();
			if (errors.length != 0) {
				res.send(pretty_JSON({ status: 'VALIDATION_ERROR', errors: errors}));
				return;
			}
			db.run(sql,
			{
				$name: req.body.name,
				$furl: flagurl,
				$desc: req.body.description
			},
			function (err) {
				if (err) {
					res.send(pretty_JSON({ status: 'SERVER_ERROR', error: err }));
				}
				else {
					res.send(pretty_JSON({status: 'OK', id: pretty_URL(this.lastID, 'video', req), changes: this.changes}));
				}
			});
		}
		
	});
*/
});

// Redirect
app.get('/api/video', function(req, res) {
	res.redirect('/api/videos');
});

app.get('/api/video/:id', function (req, res) {
	
	db.serialize(function() {
		db.get('SELECT * FROM videos WHERE id="' + req.params.id + '" OR name="' + req.params.id + '"',
		function(err,row) {
			if (row == null) {
				error = {'errno': 1, 'description': 'Video no existente'};
				res.send(pretty_JSON(error));
				return;
			}
			res.send(pretty_JSON(row));
		});
	});
});

app.put('/api/video/:id', function (req, res) {
	
	Video.findByIdAndUpdate(req.params.id, req.body, function (err, video) {
		if (err) res.send(pretty_JSON(err));
		else res.send(pretty_JSON(video));
	});
	
	/*
db.serialize(function () {
		
		var sql = "UPDATE videos SET ";
		var keys = Object.keys(req.body);
		
		for (i = 0; i < keys.length; i++) {
			sql += keys[i] + '="' + req.body[keys[i]];
			sql += (i == keys.length - 1) ? '" ' : '", ';
		}
		
		sql += "WHERE id='" + req.params.id + "' OR name='" + req.params.id + "'";
		
		db.run(sql, function (err) {
			if (err)
				res.send(pretty_JSON(err));
			else
				res.send(pretty_JSON({
					id: pretty_URL((req.body.name === null) ? req.params.id : req.body.name, 'video' ,req),
					changes: this.changes
				})
			);
		});
	});
*/

});

app.delete('/api/video/:id', function (req, res) {

	Video.findOneAndRemove(req.params.id, req.body, function (err, video) {
		if (err) res.send(pretty_JSON(err));
		else res.send(pretty_JSON(video));
	});
	
	/*
db.serialize(function () {
		if (req.body.url != 'none') {
			fs.unlink(__dirname + '/public' + req.body.url, function (err) {
				if (err) throw err;
				console.log('Successfully deleted the video');
			});
		}
		db.run('DELETE FROM videos WHERE id=$id',
			{ $id: req.params.id },
			function (err) {
				if (err)
					res.send(pretty_JSON(err));
				else
					res.send(pretty_JSON({ status: 'OK' }));
			});
	});
*/
});

app.get('/api/video/:id/:col', function (req, res) {
	
	db.serialize(function() {
		db.get('SELECT ' + req.params.col + ' FROM videos WHERE id="' + req.params.id + '" OR name="' + req.params.id + '"',
		function(err,row) {
			if (err) {
				if (err['errno'] == 1) {
					err['description'] = 'Atributo no existente';
				}
				res.send(pretty_JSON(err));
				return;
			}
			res.send(pretty_JSON(row));
		});
	});
});

app.post('/api/video/:id/addComment', function (req, res) {
	
	Video.findByIdAndUpdate(
		req.params.id,
		{"$push": {comentarios: req.body }},
		function (err, pais) {
		if (err) res.send(pretty_JSON(err));
		else res.send(pretty_JSON(pais));
	});
});

/*

	Photos:
*/

app.get('/api/fotos', function (req, res) {
	
	db.serialize(function() {
		db.all('SELECT * FROM fotos',
		function(err,rows) {
			res.send(pretty_JSON(rows));
		});
	});
});

app.post('/api/fotos', function (req, res) {
	
	if (Object.size(req.files) == 1) {
		
		console.log(newPath);
		var newPath = __dirname + "/public/static/images/"+req.files.url.name;
		fs.readFile(req.files.url.path, function (err, data) {
			fs.writeFile(newPath, data, function (err) {
				if (err) {
					res.send(pretty_JSON(err));
				}
				else {
					req.body["url"] = '/static/images/'+req.files.url.name;
	/* 				flagurl = '/static/images/'+req.files.imagen.name; */
					console.log(req.body);
					
					var foto = Foto(req.body);
		
					foto.save(function (err) {
						console.log(err);
						if (err) res.send(pretty_JSON(err));
						else res.send(pretty_JSON(foto));
					});
				}
			});
		});
	} else {
		var foto = Foto(req.body);
		
		foto.save(function (err) {
			console.log(err);
			if (err) res.send(pretty_JSON(err));
			else res.send(pretty_JSON(foto));
		});
	}
	
	/*
db.serialize(function () {
		
		var validator = new Validator();
		
		validator.check(req.body.name, "La foto debe contener un nombre").notNull();
		validator.check(req.body.description, "La descripción esta vacia").notNull();
		validator.check(req.body.description, "La descripción es muy corta").len(15);
		
		sanitize(req.body.description).xss();
		
		var sql = "INSERT INTO fotos (name,url,description) VALUES ($name,$furl,$desc)";
		
		var flagurl;
		
		if (Object.size(req.files) == 0) {
			flagurl = req.body.flag_url;
			validator.check(flagurl, "La URL esta vacia").notNull();
			validator.check(flagurl, "La URL debe tener formato de URL").isUrl();
			runDB();
		}
		else {
			fs.readFile(req.files.video_url.path, function (err, data) {
				// ...
				var name = req.files.video_url.name;
				var i = name.lastIndexOf('.');
				var newPath = __dirname + "/public/static/images/"+imgNum+((i < 0) ? '' : name.substr(i));
				console.log(newPath);
				fs.writeFile(newPath, data, function (err) {
					if (err) {
						res.send(pretty_JSON(err));
					}
					else {
						flagurl = '/static/images/'+imgNum+((i < 0) ? '' : name.substr(i));
						console.log(flagurl);
						imgNum++;
						runDB();
					}
				});
			});
		}
		
		function runDB() {
			var errors = validator.getErrors();
			if (errors.length != 0) {
				res.send(pretty_JSON({ status: 'VALIDATION_ERROR', errors: errors}));
				return;
			}
			db.run(sql,
			{
				$name: req.body.name,
				$furl: flagurl,
				$desc: req.body.description
			},
			function (err) {
				if (err) {
					res.send(pretty_JSON({ status: 'SERVER_ERROR', error: err }));
				}
				else {
					res.send(pretty_JSON({status: 'OK', id: pretty_URL(this.lastID, 'foto', req), changes: this.changes}));
				}
			});
		}
		
	});
*/
});

// Redirect
app.get('/api/foto', function(req, res) {
	res.redirect('/api/fotos');
});

app.get('/api/foto/:id', function (req, res) {
	
	db.serialize(function() {
		db.get('SELECT * FROM fotos WHERE id="' + req.params.id + '" OR name="' + req.params.id + '"',
		function(err,row) {
			if (row == null) {
				error = {'errno': 1, 'description': 'Foto no existente'};
				res.send(pretty_JSON(error));
				return;
			}
			res.send(pretty_JSON(row));
		});
	});
});

app.put('/api/foto/:id', function (req, res) {
	
	Foto.findByIdAndUpdate(req.params.id, req.body, function (err, foto) {
		res.send(pretty_JSON(foto));
	});
	
	/*
db.serialize(function () {
		
		var sql = "UPDATE fotos SET ";
		var keys = Object.keys(req.body);
		
		for (i = 0; i < keys.length; i++) {
			sql += keys[i] + '="' + req.body[keys[i]];
			sql += (i == keys.length - 1) ? '" ' : '", ';
		}
		
		sql += "WHERE id='" + req.params.id + "' OR name='" + req.params.id + "'";
		
		db.run(sql, function (err) {
			if (err)
				res.send(pretty_JSON(err));
			else
				res.send(pretty_JSON({
					id: pretty_URL((req.body.name === null) ? req.params.id : req.body.name, 'foto' ,req),
					changes: this.changes
				})
			);
		});
	});
*/

});

app.delete('/api/foto/:id', function (req, res) {
	
	Foto.findByIdAndRemove(req.params.id, function (err, foto) {
		if (!err) res.send(pretty_JSON(foto));
	})
	
	/*
db.serialize(function () {
		if (req.body.url != 'none') {
			fs.unlink(__dirname + '/public' + req.body.url, function (err) {
				if (err) throw err;
				console.log('Successfully deleted the photo');
			});
		}
		db.run('DELETE FROM fotos WHERE id=$id',
			{ $id: req.params.id },
			function (err) {
				if (err)
					res.send(pretty_JSON(err));
				else
					res.send(pretty_JSON({ status: 'OK' }));
			});
	});
*/
});

app.get('/api/foto/:id/:col', function (req, res) {
	
	db.serialize(function() {
		db.get('SELECT ' + req.params.col + ' FROM fotos WHERE id="' + req.params.id + '" OR name="' + req.params.id + '"',
		function(err,row) {
			if (err) {
				if (err['errno'] == 1) {
					err['description'] = 'Atributo no existente';
				}
				res.send(pretty_JSON(err));
				return;
			}
			res.send(pretty_JSON(row));
		});
	});
});

app.post('/api/foto/:id/addComment', function (req, res) {
	
	Foto.findByIdAndUpdate(
		req.params.id,
		{"$push": {comentarios: req.body }},
		function (err, pais) {
		if (err) res.send(pretty_JSON(err));
		else res.send(pretty_JSON(pais));
	});
});

/*

	News:
*/

//Error Pages

app.use(function(req, res, next){
	res.render('404.ejs', { layout: false });
});