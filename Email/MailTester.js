/** 
 * 
 * @author Jacob Alperin-Sheriff
 * Module for finding emails, something to do to trick mailtester eventually I dunno 
 * parameters
 * Depends on MTurkScript.js as well as
 * 
 * jacobmas/pdf.js/master/dist/pdf.js
 * jacobmas/pdf.js/master/dist/pdf.worker.js
 *
 * also searches for common email address forms 
 */

/* EmailQual is an object taking an email address, the url on which it was found, 
 * the_name={fname:John,mname:Quentin,lname:Doe}, desired_domain either undefined or the domain we're looking for emails for */
function EmailQual(email,url,the_name,desired_domain) {
    if(the_name===undefined) the_name={fname:"",lname:"",mname:""};
    var fname=the_name.fname.replace(/\'/g,"").toLowerCase(),lname=the_name.lname.replace(/[\'\s]/g,"").toLowerCase();
    this.fname=the_name.fname;
    this.lname=the_name.lname;
    var email_regexps=
        [new RegExp("^"+fname.charAt(0)+"(\\.)?"+lname+"$","i"),new RegExp("^"+fname+"[\\._]{1}"+lname+"$","i"),
         new RegExp("^"+fname+lname.charAt(0)+"$","i"),new RegExp("^"+lname+fname.charAt(0)+"$","i")];
    this.email=email;
    this.url=url;
    this.domain=email.replace(/^[^@]*@/,"");
    this.quality=0;
    var email_begin=this.email.replace(/@[^@]*$/,"").toLowerCase();
    if(new RegExp(fname,"i").test(email_begin)) this.quality=1;
    if(new RegExp(lname.substr(0,5),"i").test(email_begin)) {
        this.quality=2;
        if(email_begin.toLowerCase().indexOf(lname.replace(/\'/g,"").toLowerCase())>0 &&
           fname.toLowerCase().charAt(0)===email_begin.toLowerCase().charAt(0)) this.quality=3;
    }
    /* Check if it's bad because wrong names */
    var split=email_begin.split(/[_\.]/);
    for(var i=0;i<email_regexps.length;i++) if(email_regexps[i].test(email_begin)) this.quality=4;
    
    if(desired_domain && this.domain.toLowerCase().indexOf(desired_domain.toLowerCase())!==-1&&this.quality>0) this.quality+=4;
    else if(!desired_domain && this.quality>0) this.quality+=4; /* Added before domain found on query search */
    if(split.length>1) {
        var l_reg=new RegExp(lname,"i"),f_reg=new RegExp(fname,"i");
        if((f_reg.test(split[0]) && !l_reg.test(split[split.length-1])) ||
           (f_reg.test(split[split.length-1]) && !l_reg.test(split[0])) ||
           (!f_reg.test(split[0]) && l_reg.test(split[split.length-1]))||
           (!f_reg.test(split[split.length-1]) && l_reg.test(split[0]))) {
            this.quality=0;
        }
    }
    if(/app\.lead411\.com/.test(this.url)) this.quality=0;
};

/* for sorting EmailQual elements */
EmailQual.email_cmp=function(a,b) {
    try {
        if(a.quality!==b.quality) return b.quality-a.quality;
        else if(a.url<b.url) return -1;
        else if(b.url<a.url) return 1;
        else if(a.email.split("@")[1]<b.email.split("@")[1]) return -1;
        else if(a.email.split("@")[1]>b.email.split("@")[1]) return 1;
        else if(a.email.split("@")[0]<b.email.split("@")[0]) return -1;
        else if(a.email.split("@")[0]>b.email.split("@")[0]) return 1;
        else return 0;
    }
    catch(error) { return 0; }
};

function PDFParser(url) {
    //        console.log("fuck");
    this.url=url;
    //      this.pdf=pdf;
    this.email_list=[];
    this.pdfjsLib = window['pdfjs-dist/build/pdf'];

    // The workerSrc property shall be specified.
    this.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://raw.githubusercontent.com/jacobmas/pdf.js/master/dist/pdf.worker.js';
    console.log("MUck");
}

PDFParser.prototype.parsePDF=function(resolve,reject) {
    var parser=this;
    // Asynchronous download of PDF
    var src={url:this.url,mode:'no-cors'};
    var loadingTask = this.pdfjsLib.getDocument(src);
    loadingTask.promise.then(function(pdf) {
        parser.pdf=pdf;


        var curr_promise=new Promise((resolve,reject) => {

            parser.extractEmails(resolve,reject);
        });
        curr_promise.then(function() {
            console.log("parser.email_list="+parser.email_list);
            resolve(parser.email_list);
        }).catch(function(response) {
            console.log("failed curr_promise,response="+response); });
    })
        .catch(function(response) {
        console.log("error in loadingTask="+JSON.stringify(response));});
}

PDFParser.prototype.extractEmails=function(resolve,reject) {
    var i;
    console.log("in extractEmails");
    var email_promise_list=[];
    var parser=this;
    for(i=1;i<=this.pdf.numPages;i++) {
        email_promise_list.push(this.createEmailPromise(this,this.pdf,i));
    }
    Promise.all(email_promise_list).then(function() { resolve(parser.email_list); }).catch(reject);
}
PDFParser.prototype.createEmailPromise=function(parser,pdf,pageNum) {
    return new Promise((inner_resolve,inner_reject) => {
        pdf.getPage(pageNum).then(function(page) {
            console.log("page=");
            console.log(page);
            parser.parseEmails(page,pageNum,inner_resolve,inner_reject); }).catch(function(response) {
            console.log("Failed getting page "+response); })
    }).then(function(email_list) {
        parser.email_list=parser.email_list.concat(email_list);
    });
}



PDFParser.prototype.parseEmails=function(page,pageNum,resolve,reject) {
    var my_email_re = /(([^<>()\[\]\\.,;:\s@"：+=\/\?%\*]{1,40}(\.[^<>\/()\[\]\\.,;:：\s\*@"\?]{1,40}){0,5}))@((([a-zA-Z\-0-9]{1,30}\.){1,8}[a-zA-Z]{2,20}))/g;
    var email_list=[];
    console.log(page);
    page.getTextContent().then(function(textContent) {
        var curr,match;
        for(curr of textContent.items) {
            if((match=curr.str.match(my_email_re))) email_list=email_list.concat(match);
        }
        resolve(email_list);
    });
};


/* the_name is of the format {fname:John,mname:Quentin,lname:Doe} or such, domain is the email domain being attempted,
* resolve and reject should come from a Promise
* will resolve on ITSELF as the parameter, so the caller can do whatever with the information therein 
* resolve_early is an indicator variable for if we should resolve as soon as a good enough email is found
*
* Program logic: we do another do_next_email_query after resolving a Promise where we search for the email using Bing
*
*
*
*/
function MailTester(the_name,domain,resolve,reject,resolve_early,mailtester_callback) {
    this.fullname=the_name;
    this.lname=the_name.lname.replace(/[\'\s]/g,"").toLowerCase();
    this.fname=the_name.fname.replace(/\'/g,"").toLowerCase();
    this.minit=the_name.mname&&the_name.mname.length>0?the_name.mname.toLowerCase().charAt(0):"";

    Object.assign(this,{resolve:resolve,reject:reject,mailtester_callback,mailtester_callback,domain:domain,
			totalEmail:0,doneEmail:0,found_good:false,resolve_early:resolve_early||false,email_list:[]});
    this.email_types=[this.fname.charAt(0)+this.lname+"@"+this.domain,
                          this.fname+"."+this.lname+"@"+this.domain,
                          this.lname+"."+this.fname+"@"+this.domain,
                         this.fname+"_"+this.lname+"@"+this.domain,
                         this.fname+this.lname+"@"+this.domain,
                         this.lname+this.fname.charAt(0)+"@"+this.domain,
                         this.fname+this.lname.charAt(0)+"@"+this.domain,
                         this.lname+"@"+this.domain,
                              this.fname+"@"+this.domain,
                              this.fname+"."+this.minit+"."+this.lname+"@"+this.domain
                     ];
    this.curr_mailtester_num=0; // current mailtester query being done
    // Indicator variable if we either confirmed an email successfully or can't confirm with this domain
    this.done_with_mailtester=false;     
    this.do_next_email_query();
};

MailTester.email_re = /(([^<>()\[\]\\.,;:\s@"：+=\/\?%\*]{1,40}(\.[^<>\/()\[\]\\.,;:：\s\*@"\?]{1,40}){0,5}))@((([a-zA-Z\-0-9]{1,30}\.){1,8}[a-zA-Z]{2,20}))/g;

MailTester.bad_urls=["facebook.com","youtube.com","twitter.com","instagram.com","opendi.us",".business.site","plus.google.com",
		     ".alibaba.com",".trystuff.com",".mturkcontent.com",".amazonaws.com",".medium.com",".google.com",
		     ".opencorporates.com",".thefreedictionary.com",".dictionary.com",".crunchbase.com",".yumpu.com",
		     
		     "beenverified.com","downloademail.info","email-format.com",".facebook.com",".niche.com","en.wikipedia.org",
		     "hunter.io","issuu.com","/app.lead411.com","linkedin.com",".lead411.com",
                     ".privateschoolreview.com","scribd.com","/lusha.co","patents.justia.com",".skymem.com",
		     "/ufind.name",".yelp.com",".zoominfo.com"];

/* Do the next email query for the current position in email_types */
MailTester.prototype.do_next_email_query=function(self) {
    var search_str, emailPromise;
    if(!self) self=this;
//    var self=this;
    console.log("do_next_email, query,curr_query_num="+this.curr_mailtester_num);
    self.email_list.sort(EmailQual.email_cmp);
    if(self.curr_mailtester_num<self.email_types.length) {
        let curr_email=self.email_types[self.curr_mailtester_num];
        self.curr_mailtester_num++;
        search_str="\""+curr_email+"\"";
	// Don't do mailtester queries if we've found one already 
        if(!self.done_with_mailtester && (self.email_list.length===0 || self.email_list[0].quality<6)) {
	    self.do_mailtester_query(curr_email,self); }
	
        // Leaving out search initially???
	else if(self.resolve_early&&self.email_list.length>0 && self.email_list[0].quality>=6&&false) {
	    console.log("Resolving early");
	    self.resolve(self.email_list);
	    return;
	}
	// after emailPromise resolves, do more queries
	emailPromise = new Promise((email_resolve,email_reject) => {
	    console.log("Beginning emailPromise");
            MTurkScript.prototype.query_search(search_str,email_resolve,email_reject,self.query_response,"email","",self);
	});
	emailPromise.then(function() { self.do_next_email_query(self) })
	    .catch(function(response) {
		console.log("Failed emailPromise,response="+response);
		self.do_next_email_query(self) });

	// don't resolve yet if we're not done
	return;
    }
	// If we've found a good email, we can resolve early
    self.email_list.sort(EmailQual.email_cmp);
    self.resolve(self.email_list);
};
   
/* do a query of mailtester.com */
/* do a query of mailtester.com */
MailTester.prototype.do_mailtester_query=function(email,self) {

    var url="https://mailtester.com/testmail.php";
    var data={"lang":"en","email":email};
    var headers={"host":"mailtester.com","origin":"https://mailtester.com",
		 "Content-Type": "application/x-www-form-urlencoded",
                 "referer":"https://mailtester.com/testmail.php",
		 "Sec-Fetch-Mode": "navigate",
		 "Sec-Fetch-Site": "same-origin",
"Sec-Fetch-User": "?1"
		};
    var data_str=MTurkScript.prototype.json_to_post(data);
    console.log("do_mailtester_query, email="+email+", data_str="+data_str);
    if(!self) self=this;
    var promise=new Promise((resolve,reject) => {
        if(self.done_with_mailtester) return;
        GM_xmlhttpRequest({method: 'POST', headers:headers,data:data_str,anonymous:true,
                           url: url,
                           onload: function(response) {
                               var doc = new DOMParser().parseFromString(response.responseText, "text/html");
                               self.mailtester_response(doc,response.finalUrl, resolve, reject,email,self);
                           },
                           onerror: function(response) { reject("Fail mailtester"); },ontimeout: function(response) { reject("Fail"); }
                          });
    });
    promise.then(function() {
	if(typeof self.mailtester_callback === 'function') self.mailtester_callback(self.email_list);
    }).catch(function() {
        if(typeof self.mailtester_callback === 'function') self.mailtester_callback(self.email_list);
    });
};


/* response to a mailtester query */
MailTester.prototype.mailtester_response=function(doc,url,resolve,reject,email,self) {
    if(!self) self=this;

    console.log("mailtester_response,doc.body.innerHTML.length="+doc.body.innerHTML.length);
    var table=doc.querySelector("#content > table");
    if(table) {
        let lastRow=table.rows[table.rows.length-1];
        let lastCell=lastRow.cells[lastRow.cells.length-1];
        let cellText=lastCell.innerText;
        console.log("email="+email+", lastCell="+lastCell.innerHTML);
        if(cellText.indexOf("E-mail address is valid")!==-1||
           cellText.indexOf("The user you are trying to contact is receiving mail at a rate that")!==-1) {
            this.email_list.push(new EmailQual(email,url,this.fullname,this.domain));
            this.done_with_mailtester=true;
        }
        else if(cellText.indexOf("Server doesn\'t allow e-mail address verification")!==-1||
                cellText.indexOf("Internal resource temporarily unavailable")!==-1||cellText.indexOf("Connection refused")!==-1||
                cellText.indexOf("The domain is invalid or no mail server was found for it")!==-1) {
            // Don't waste precious queries
            console.log("Setting found_with_mailtester due to not allowed");
            this.done_with_mailtester=true;
        }

    }
    else {
        console.log("no table");//doc.body.innerHTML="+doc.body.innerHTML);
    }
    resolve("");
};

/* Query response specifically for finding emails */
MailTester.prototype.query_response=function(response,resolve,reject,type,self) {
    var doc = new DOMParser().parseFromString(response.responseText, "text/html");
    console.log("in query_response\n"+response.finalUrl+", type="+type);
    var search, b_algo, i=0;
    var b_url, b_name, b_factrow, b_caption,p_caption,loop_result,b1_success=false;
    var promise_list=[];
    try {
        search=doc.getElementById("b_content");
        b_algo=search.getElementsByClassName("b_algo");
        for(i=0; i < b_algo.length; i++) {
            b_url=self.query_response_loop(b_algo,i,type,promise_list,resolve,reject,b1_success,self);
            if(b_url&&(b1_success=true)) break;
        }
        if(type==="email") {
            self.totalEmail++;
            Promise.all(promise_list).then(function() {
		console.log("Done with "+response.finalUrl);
                self.doneEmail++;
		resolve("");
                 })
                .catch(function() {
		    console.log("Done with "+response.finalUrl);

                    self.doneEmail++;
                    resolve(""); });
            return;
	}
    }
    catch(error) {
        reject(error);
        return;
    }
    
    reject("Nothing found");
    return;
};

/* Parse a single bing search result on a page */
MailTester.prototype.query_response_loop=function(b_algo,i,type,promise_list,resolve,reject,b1_success,self) {
    var b_name,b_url,p_caption,b_caption;
    var mtch,j,people;
    b_name=b_algo[i].getElementsByTagName("a")[0].textContent;
    b_url=b_algo[i].getElementsByTagName("a")[0].href;
    b_caption=b_algo[i].getElementsByClassName("b_caption");
    p_caption=(b_caption.length>0 && b_caption[0].getElementsByTagName("p").length>0) ?
        p_caption=b_caption[0].getElementsByTagName("p")[0].innerText : '';

    p_caption=p_caption.replace(/\.\s+/g," ");
    if(/(email|query)/.test(type) && (mtch=p_caption.match(MailTester.email_re))) {
        for(j=0; j < mtch.length; j++) {
	    if(!MTurkScript.prototype.is_bad_email(mtch[j]) &&
	       mtch[j].length>0) self.email_list.push(new EmailQual(mtch[j],b_url,self.fullname,self.domain));
	}
    }
    /*  Hopefully PDF parser is integrated now? */
    if(type==="email" && i <=3 && !/\.(xls|xlsx|pdf|doc)$/.test(b_url)&&
       !MTurkScript.prototype.is_bad_url(b_url,MailTester.bad_urls,-1)) {
        promise_list.push(MTurkScript.prototype.create_promise(
	    b_url,self.contact_response,MTurkScript.prototype.my_then_func,MTurkScript.prototype.my_catch_func,self));
    }
    else if(type=="email" && i<=3 && /\.pdf$/.test(b_url)) {
	var parser=new PDFParser(b_url);
	promise_list.push(new Promise((inner_resolve,inner_reject) => {
	    parser.parsePDF(inner_resolve,inner_reject);
	}).then(function(result) {
	    let x;
	    for(x of result) self.email_list.push(new EmailQual(x,parser.url));
	}).catch(MTurkScript.prototype.my_catch_func));
    }
    return null;
};

/**
     * contact_response Here it searches for an email, the "gold standard" short version of contact_response */
MailTester.prototype.contact_response=function(doc,url,resolve,reject,self) {
    console.log("in contact_response,url="+url);
    var i,j,temp_email,links=doc.links,email_matches;
    var temp_url,curr_url;
    doc.body.innerHTML=doc.body.innerHTML.replace(/\s*([\[\(]{1})\s*at\s*([\)\]]{1})\s*/,"@")
        .replace(/\s*([\[\(]{1})\s*dot\s*([\)\]]{1})\s*/,".").replace(/dotcom/,".com");
    MTurkScript.prototype.fix_emails(doc,url);
    if((email_matches=doc.body.innerHTML.match(MailTester.email_re))) {
        for(j=0; j < email_matches.length; j++) {
            if(!MTurkScript.prototype.is_bad_email(email_matches[j]) &&
	       email_matches[j].length>0) self.email_list.push(new EmailQual(email_matches[j].toString(),url,self.fullname,self.domain));
        }
    }
    for(i=0; i < links.length; i++) {
        try {
            if((temp_email=links[i].href.replace(/^mailto:\s*/,"").match(MailTester.email_re)) &&
               !MTurkScript.prototype.is_bad_email(temp_email[0])) {
		self.email_list.push(new EmailQual(temp_email.toString(),url,self.fullname,self.domain)); }
        }
        catch(error) { console.log("Error with emails "+error); }
    }
    console.log("* doing doneQueries++ for "+url);
    resolve("");
    return;
};

