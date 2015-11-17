"use strict";

const subject = {
	img: (() =>
		dom.get("handleimg"))(),
	imgClear: function() {
		subject.img.src = "hmm.png";
	},
	handle: _.debounce(function() {
		subject.checkName(this.value)
			.then(result => {
				subject.img.src = "ok.png";
				//console.log(result);
			})
			.catch(err => subject.img.src = err === "" ? "smile.png" : "nogood.png");
	}, 600),
	checkName: name => 
		/^[a-zA-Z0-9_]{1,15}$/.test(name) ?
			ajax("GET", `/api/userid?uname=${name}`) :
			Promise.reject(name === "" ? "" : null)
};
