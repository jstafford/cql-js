function indent(n) {
    var s = "";
    for (var i = 0; i < n; i++)
        s = s + " ";
    return s;
}
// CQLModifier
var CQLModifier = function () {
    this.name = null;
    this.relation = null;
    this.value = null;
}

CQLModifier.prototype = {
    toString: function () {
      return this.name + this.relation + this.value;
    },

    toXCQL: function (n) {
        var s = indent(n+1) + "<modifier>\n";
        s = s + indent(n+2) + "<name>" + this.name + "</name>\n";
        if (this.relation != null)
            s = s + indent(n+2) 
                + "<relation>" + this.relation + "</relation>\n";
        if (this.value != null)
            s = s + indent(n+2) 
                + "<value>" + this.value +"</value>\n";
        s = s + indent(n+1) + "</modifier>\n";
        return s;
    },

    toFQ: function () {
        //we ignore modifier relation symbol, for value-less modifiers
        //we assume 'true'
        var value = this.value.length > 0 ? this.value : "true";
        var s = '"'+this.name+'": "'+value+'"';
        return s;
    }
}

// CQLSearchClause
var CQLSearchClause = function (field, fielduri, relation, relationuri, 
                                modifiers, term) {
    this.field = field;
    this.fielduri = fielduri;
    this.relation = relation;
    this.relationuri = relationuri;
    this.modifiers = modifiers;
    this.term = term;
}

CQLSearchClause.prototype = {
    toString: function () {
      return (this.field ? this.field + ' ' : '') + 
        (this.relation ? this.relation : '') +
        (this.modifiers.length > 0 ? '/' + this.modifiers.join('/') : '') +
        (this.relation || this.modifiers.length ? ' ' : '') +
        '"' + this.term + '"';
    },

    toXCQL: function (n) {
        var s = indent(n) + "<searchClause>\n";
        if (this.fielduri.length > 0)
        {
            s = s + indent(n+1) + "<prefixes>\n" +
                indent(n+2) + "<prefix>\n" +
                indent(n+3) + "<identifier>" + this.fielduri +
                "</identifier>\n" +
                indent(n+2) + "</prefix>\n" +
                indent(n+1) + "</prefixes>\n";
        }
        s = s + indent(n+1) + "<index>" + this.field + "</index>\n";
        s = s + indent(n+1) + "<relation>\n";
        if (this.relationuri.length > 0) {
            s = s + indent(n+2) +
                "<identifier>" + this.relationuri + "</identifier>\n";
        }
        s = s + indent(n+2) + "<value>" + this.relation + "</value>\n";
        if (this.modifiers.length > 0) {
            s = s + indent(n+2) + "<modifiers>\n";
            for (var i = 0; i < this.modifiers.length; i++)
                s = s + this.modifiers[i].toXCQL(n+2);
            s = s + indent(n+2) + "</modifiers>\n";
        }
        s = s + indent(n+1) + "</relation>\n";
        s = s + indent(n+1) + "<term>" + this.term + "</term>\n";
        s = s + indent(n) + "</searchClause>\n";
        return s;
    },

    toFQ: function () {
        var s = '{ "term": "'+this.term+'"';
        if (this.field.length > 0 && this.field != 'cql.serverChoice')
          s+= ', "field": "'+this.field+'"';
        if (this.relation.length > 0 && this.relation != 'scr')
          s+= ', "relation": "'+this._mapRelation(this.relation)+'"';
        for (var i = 0; i < this.modifiers.length; i++) {
          //since modifiers are mapped to keys, ignore the reserved ones
          if (this.modifiers[i].name == "term"
            ||this.modifiers[i].name == "field"
            ||this.modifiers[i].name == "relation")
            continue;
          s += ', ' + this.modifiers[i].toFQ();
        }
        s += ' }';
        return s;
    },

    _mapRelation: function (rel) {
      switch(rel) {
        case "<" : return "lt";
        case ">" : return "gt";
        case "=" : return "eq";
        case "<>" : return "ne";
        case ">=" : return "ge";
        case "<=" : return "le";
        default: return rel;
      }
    },

    _remapRelation: function (rel) {
      switch(rel) {
        case "lt" : return "<";
        case "gt" : return ">";
        case "eq" : return "=";
        case "ne" : return "<>";
        case "ge" : return ">=";
        case "le" : return "<=";
        default: return rel;
      }
    }

}
// CQLBoolean
var CQLBoolean = function() {
    this.op = null;
    this.modifiers = null;
    this.left = null;
    this.right = null;
}

CQLBoolean.prototype = {
    toString: function () {
      return (this.left.op ? '(' + this.left + ')' : this.left) + ' ' + 
        this.op.toUpperCase() +
        (this.modifiers.lenght > 0 ? '/' + this.modifiers.join('/') : '') + 
        ' ' + (this.right.op ? '(' + this.right + ')' : this.right);;
    },
    toXCQL: function (n) {
        var s = indent(n) + "<triple>\n";
        s = s + indent(n+1) + "<boolean>\n" +
            indent(n+2) + "<value>" + this.op + "</value>\n";
        if (this.modifiers.length > 0) {
            s = s + indent(n+2) + "<modifiers>\n";
            for (var i = 0; i < this.modifiers.length; i++)
                s = s + this.modifiers[i].toXCQL(n+2);
            s = s + indent(n+2) + "</modifiers>\n";
        }
        s = s + indent(n+1) + "</boolean>\n";
        s = s + indent(n+1) + "<leftOperand>\n" +
            this.left.toXCQL(n+2) + indent(n+1) + "</leftOperand>\n";

        s = s + indent(n+1) + "<rightOperand>\n" +
            this.right.toXCQL(n+2) + indent(n+1) + "</rightOperand>\n";
        s = s + indent(n) + "</triple>\n";
        return s;
    },

    toFQ: function () {
      var s = ' { "op": "'+this.op+'"';
      //proximity modifiers
      for (var i = 0; i < this.modifiers.length; i++)
        s += ', ' + this.modifiers[i].toFQ();
      s += ', "s1": '+this.left.toFQ();
      s += ', "s2": '+this.right.toFQ();
      s += ' }'
      return s;
    }

}
// CQLParser
var CQLParser = function () {
    this.qi = null;
    this.ql = null;
    this.qs = null;
    this.look = null;
    this.lval = null;
    this.val = null;
    this.prefixes = new Object();
    this.tree = null;
}

CQLParser.prototype = {
    parse: function (query) {
        if (!query)
            throw new Error("The query to be parsed cannot be empty");
        
        this.qs = query;
        this.ql = this.qs.length;
        this.qi = 0;
        this._move(); 
        this.tree = this._parseQuery("cql.serverChoice", "scr", new Array());
        if (this.look != "")
            throw new Error("EOF expected");
    },
    parseFromFQ: function (query) {
       if (!query)
          throw new Error("The query to be parsed cannot be empty");
       if (typeof query == 'string')
         query = JSON.parse(query);
       this.tree = this._parseFromFQ(query);
    },
    _parseFromFQ: function (fq) {
        //op-node
        if (fq.hasOwnProperty('op') 
            && fq.hasOwnProperty('s1')
            && fq.hasOwnProperty('s2')) {
          var node = new CQLBoolean();
          node.op = fq.op;
          node.left = this._parseFromFQ(fq.s1);
          node.right = this._parseFromFQ(fq.s2);
          //include all other members as modifiers
          node.modifiers = [];
          for (var key in fq) {
            if (key == 'op' || key == 's1' || key == 's2')
              continue;
            var mod = new CQLModifier();
            mod.name = key;
            mod.relation = '=';
            mod.value = fq[key];
            node.modifiers.push(mod);
          }
          return node;
        }
        //search-clause node
        if (fq.hasOwnProperty('term')) {
          var node = new CQLSearchClause();
          node.term = fq.term;
          node.field = fq.hasOwnProperty('field') 
            ? fq.field : 'cql.serverChoice';
          node.relation = fq.hasOwnProperty('relation')
            ? node._remapRelation(fq.relation) : 'scr';
          //include all other members as modifiers
          node.relationuri = '';
          node.fielduri = '';
          node.modifiers = [];
          for (var key in fq) {
            if (key == 'term' || key == 'field' || key == 'relation')
              continue;
            var mod = new CQLModifier();
            mod.name = key;
            mod.relation = '=';
            mod.value = fq[key];
            node.modifiers.push(mod);
          }
          return node;
        }
        throw new Error('Unknow node type; '+JSON.stringify(fq));
    },
    toXCQL: function () {
        return this.tree.toXCQL();
    },
    toFQ: function () {
        return this.tree.toFQ();
    },
    toString: function () {
        return this.tree.toString();
    },
    _parseQuery: function(field, relation, modifiers) {
        var left = this._parseSearchClause(field, relation, modifiers);
        while (this.look == "s" && (
                    this.lval == "and" ||
                    this.lval == "or" ||
                    this.lval == "not" ||
                    this.lval == "prox")) {
            var b = new CQLBoolean();
            b.op = this.lval;
            this._move();
            b.modifiers = this._parseModifiers();
            b.left = left;
            b.right = this._parseSearchClause(field, relation, modifiers);
            left = b;
        }
        return left;
    },
    _parseModifiers: function() {
        var ar = new Array();
        while (this.look == "/") {
            this._move();
            if (this.look != "s" && this.look != "q")
                throw new Error("Invalid modifier.")
            
            var name = this.lval;
            this._move();
            if (this.look.length > 0 
                && this._strchr("<>=", this.look.charAt(0))) {
                var rel = this.look;
                this._move();
                if (this.look != "s" && this.look != "q")
                    throw new Error("Invalid relation within the modifier.");
                
                var m = new CQLModifier();
                m.name = name;
                m.relation = rel;
                m.value = this.val;
                ar.push(m);
                this._move();
            } else {
                var m = new CQLModifier();
                m.name = name;
                m.relation = "";
                m.value = "";
                ar.push(m);
            }
        }
        return ar;
    },
    _parseSearchClause: function(field, relation, modifiers) {
        if (this.look == "(") {
            this._move();
            var b = this._parseQuery(field, relation, modifiers);
            if (this.look == ")")
                this._move();
            else
                throw new Error("Missing closing parenthesis.");

            return b;
        } else if (this.look == "s" || this.look == "q") {
            var first = this.val;   // dont know if field or term yet
            this._move();
            if (this.look == "q" ||
                    (this.look == "s" &&
                     this.lval != "and" &&
                     this.lval != "or" &&
                     this.lval != "not" &&
                     this.lval != "prox")) {
                var rel = this.val;    // string relation
                this._move();
                return this._parseSearchClause(first, rel,
                                               this._parseModifiers());
            } else if (this.look.length > 0 
                       && this._strchr("<>=", this.look.charAt(0))) {
                var rel = this.look;   // other relation <, = ,etc
                this._move();
                return this._parseSearchClause(first, rel, 
                                               this._parseModifiers());
            } else {
                // it's a search term
                var pos = field.indexOf('.');
                var pre = "";
                if (pos != -1)
                    pre = field.substring(0, pos);
                
                var uri = this._lookupPrefix(pre);
                if (uri.length > 0)
                    field = field.substring(pos+1);
                
                pos = relation.indexOf('.');
                if (pos == -1)
                    pre = "cql";
                else
                    pre = relation.substring(0, pos);

                var reluri = this._lookupPrefix(pre);
                if (reluri.Length > 0)
                    relation = relation.Substring(pos+1);

                var sc = new CQLSearchClause(field,
                        uri,
                        relation,
                        reluri,
                        modifiers,
                        first);
                return sc;
            }
        // prefixes
        } else if (this.look == ">") {
            this._move();
            if (this.look != "s" && this.look != "q")
                throw new Error("Expecting string or a quoted expression.");
            
            var first = this.lval;
            this._move();
            if (this.look == "=")
            {
                this._move();
                if (this.look != "s" && this.look != "q")
                    throw new Error("Expecting string or a quoted expression.");
                
                this._addPrefix(first, this.lval);
                this._move();
                return this._parseQuery(field, relation, modifiers);
            } else {
                this._addPrefix("default", first);
                return this._parseQuery(field, relation, modifiers);
            }
        } else {
            throw new Error("Invalid search clause.");
        }

    },
    _move: function () {
        while (this.qi < this.ql 
               && this._strchr(" \t\r\n", this.qs.charAt(this.qi)))
            this.qi++;
        if (this.qi == this.ql) {
            this.look = "";
            return;
        }
        var c = this.qs.charAt(this.qi);
        if (this._strchr("()/", c)) {
            this.look = c;
            this.qi++;
        } else if (this._strchr("<>=", c)) {
            this.look = c;
            this.qi++;
            while (this.qi < this.ql 
                   && this._strchr("<>=", this.qs.charAt(this.qi))) {
                this.look = this.look + this.qs.charAt(this.qi);
                this.qi++;
            }
        } else if (this._strchr("\"'", c)) {
            this.look = "q";
            var mark = c;
            this.qi++;
            this.val = "";
            while (this.qi < this.ql 
                   && this.qs.charAt(this.qi) != mark) {
                if (this.qs.charAt(this.qi) == '\\' 
                    && this.qi < this.ql-1)
                    this.qi++;
                this.val = this.val + this.qs.charAt(this.qi);
                this.qi++;
            }
            this.lval = this.val.toLowerCase();
            if (this.qi < this.ql)
                this.qi++;
        } else {
            this.look = "s";
            this.val = "";
            while (this.qi < this.ql 
                   && !this._strchr("()/<>= \t\r\n", this.qs.charAt(this.qi))) {
                this.val = this.val + this.qs.charAt(this.qi);
                this.qi++;
            }
            this.lval = this.val.toLowerCase();
        }
    },
    _strchr: function (s, ch) {
        return s.indexOf(ch) >= 0
    },
    _lookupPrefix: function(name) {
        return this.prefixes[name] ? this.prefixes[name] : "";
    },
    _addPrefix: function(name, value) {
        //overwrite existing items
        this.prefixes[name] = value;
    }
}
