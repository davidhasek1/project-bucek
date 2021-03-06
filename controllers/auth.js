const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const User = require('../models/users');
const Mail = require('../models/sendEmail').cmsSendMsg;
const { validationResult } = require('express-validator');
const { use } = require('../routes/adminRoutes');

exports.getLoginPage = (req, res, next) => {
	//const isLoogedIn = req.get('Cookie').split('SL_wptGlobTipTmp=undefined; ')[1].trim().split('=')[1];
	let pwChange = req.flash('passwordChanged');
	let message = req.flash('error');
	console.log(message);

	console.log(req.session.isLoggedIn);
	res.render('auth/adminLogin', {
		pageTitle: 'Admin Login',
		isAuthenticated: false, //vyrenderuje se login page tudíš authentication je false jako výchozí stav
		errorMessage: message[0],
		password: pwChange[0],
		oldInput: {
			email: ''
		}
	});
	console.log(req.session.isLoggedIn);
};

exports.postLogin = async (req, res, next) => {
	const email = req.body.email;
	const password = req.body.password;
	const errors = validationResult(req);
	let pwChange = req.flash('passwordChanged');

	if (!errors.isEmpty()) {
		console.log(errors);
		return res.status(422).render('auth/adminLogin', {
			pageTitle: 'Admin Login',
			isAuthenticated: false, //vyrenderuje se login page tudíš authentication je false jako výchozí stav
			errorMessage: errors.array()[0].msg,
			password: pwChange[0],
			oldInput: {
				email: email
			}
		});
	}

	try {
		const user = await User.findByEmail(email);
		if (!user) {
			req.flash('error', 'Invalid email or password');
			return res.redirect('/admin');
		}
		const pwDoMatch = await bcrypt.compare(password, user.password);
		console.log('PW match ' + pwDoMatch);
		if (pwDoMatch) {
			req.session.isLoggedIn = true;
			console.log('Session ' + req.session.isLoggedIn);
			req.session.user = user; //K dané session je přřazen user . nalezený user je uložen v session   //req.session.user je dostupnej všude kvuli session middlewareu v app.js
			return req.session.save((err) => {
				// nejprve se uloží session a pak se s jistotou vyrenderuje full page bez prodlení
				console.log(err);
				res.redirect('/admin/cms');
			});
		}
		req.flash('error', 'Invalid email or password');
		res.redirect('/admin');
	} catch (error) {
		console.log(err);
	}
};

exports.postLogout = (req, res, next) => {
	req.session.destroy((err) => {
		//destroy session při aktualní aktivní session
		console.log(err);
		res.redirect('/admin'); // přesměrování na admin login
	});
};

exports.getReset = (req, res, next) => {
	let errorMsg = req.flash('error');
	let resetPass = req.flash('passwordReset');
	res.render('auth/reset', {
		pageTitle: 'Reset Password',
		errorMessage: errorMsg[0],
		resetEmail: resetPass[0]
	});
};

exports.postReset = (req, res, next) => {
	const email = req.body.email;
	crypto.randomBytes(32, async (err, buffer) => {
		try {
			if (err) {
				console.log(err);
				return res.redirect('/reset');
			}
			const token = buffer.toString('hex');
			const user = await User.findByEmail(email);
			if (!user) {
				req.flash('error', 'Email addres does not exists');
				return res.redirect('/reset');
			}
			const userToken = await User.setReset(user, token);
			console.log('DB resetToken update ducument OK');
			req.flash('passwordReset', 'Email sent!');
			console.log(userToken);
			res.redirect('/reset');
			await Mail.resetPassword(email, token);
		} catch (error) {
			console.log(error);
		}
	});
};

exports.getNewPassPage = async (req, res, next) => {
	const token = req.params.token;
	try {
		const userWithToken = await User.findToken(token);
		if (!userWithToken) {
			return res.redirect('/');
		}
		res.render('auth/newpassword', {
			pageTitle: 'Set new Password',
			userID: userWithToken._id.toString(),
			passwordToken: token,
			error: null
		});
		
	} catch (error) {
		console.log(error);
	}
};
exports.postNewPassword = async (req, res, next) => {
	const ID = req.body.userId;
	const password = req.body.password;
	const token = req.body.passwordToken;
	const errors = validationResult(req);

	if (!errors.isEmpty()) {
		res.status(422).render('auth/newpassword', {
			pageTitle: 'Set new Password',
			userID: ID,
			passwordToken: token,
			error: errors.array()[0].msg
		});
	}

	try {
		const user = await User.findById(ID);
		const hash = await bcrypt.hash(password, 12);
		const pwUpdate = await User.updatePassword(user, token, hash);
		console.log(pwUpdate);
		req.flash('passwordChanged', 'Your password was change');
		res.redirect('/admin');
	} catch (error) {
		console.log(error);
	}
};
