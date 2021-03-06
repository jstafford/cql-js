import btoa from 'btoa'

const DEFAULT_SERVER_CHOICE_FIELD = 'cql.serverChoice'
const DEFAULT_SERVER_CHOICE_RELATION = 'scr'
const DEFAULT_SERVER_PREFIX = 'cql'

const indent = (n, c) => {
  let s = ''
  for (let i = 0; i < n; i++) {
    s += c
  }
  return s
}

class CQLModifier {
  constuctor () {
    this.name = null
    this.relation = null
    this.value = null
  }

  toString () {
    return this.name + this.relation + this.value
  }

  toXCQL (n, c) {
    let s = `${indent(n + 1, c)}<modifier>\n`
    s = s + indent(n + 2, c) + '<name>' + this.name + '</name>\n'
    if (this.relation != null) {
      s = s + indent(n + 2, c) + '<relation>' + this.relation + '</relation>\n'
    }
    if (this.value != null) {
      s = s + indent(n + 2, c) + '<value>' + this.value + '</value>\n'
    }
    s = s + indent(n + 1, c) + '</modifier>\n'
    return s
  }

  toFQ () {
    // we ignore modifier relation symbol, for value-less modifiers
    // we assume 'true'
    let value = this.value.length > 0 ? this.value : 'true'
    let s = `"${this.name}": "${value}"`
    return s
  }
}

class CQLSearchClause {
  constructor (field, fielduri, relation, relationuri, modifiers, term, prefixes, scf, scr) {
    this.field = field
    this.fielduri = fielduri
    this.relation = relation
    this.relationuri = relationuri
    this.modifiers = modifiers
    this.term = term
    this.prefixes = prefixes
    this.scf = scf || DEFAULT_SERVER_CHOICE_FIELD
    this.scr = scr || DEFAULT_SERVER_CHOICE_RELATION
  }

  toString () {
    let field = this.field
    let fielduri = this.fielduri
    let relation = this.relation
    let relationuri = this.relationuri
    let modifiers = this.modifiers.length > 0 ? '/' + this.modifiers.join('/') : ''
    if (field === this.scf && relation === this.scr) {
        // avoid redundant field/relation
      field = null
      relation = null
    }
    if (!field) {
      field = ''
    }
    if (fielduri) {
      let prefix = this.prefixes.uriToPrefix(fielduri)
      if (prefix) {
        field = `${prefix}.${field}`
      }
    }
    if (!relation) {
      relation = ''
    }
    if (relationuri) {
      let prefix = this.prefixes.uriToPrefix(relationuri)
      if (DEFAULT_SERVER_PREFIX === prefix) {
        // avoid redundant prefixing
        prefix = ''
      }
      if (prefix) {
        relation = `${prefix}.${relation}`
      }
    }

    return (field ? field + ' ' : '') +
        relation +
        modifiers +
        (relation || modifiers ? ' ' : '') +
        '"' + this.term + '"'
  }

  toXCQL (n, c) {
    let s = indent(n, c) + '<searchClause>\n'
    if (this.fielduri.length > 0) {
      s = s + indent(n + 1, c) + '<prefixes>\n' +
                indent(n + 2, c) + '<prefix>\n' +
                indent(n + 3, c) + '<identifier>' + this.fielduri +
                '</identifier>\n' +
                indent(n + 2, c) + '</prefix>\n' +
                indent(n + 1, c) + '</prefixes>\n'
    }
    s = s + indent(n + 1, c) + '<index>' + this.field + '</index>\n'
    s = s + indent(n + 1, c) + '<relation>\n'
    if (this.relationuri.length > 0) {
      s = s + indent(n + 2, c) +
                '<identifier>' + this.relationuri + '</identifier>\n'
    }
    s = s + indent(n + 2, c) + '<value>' + this.relation + '</value>\n'
    if (this.modifiers.length > 0) {
      s = s + indent(n + 2, c) + '<modifiers>\n'
      for (let i = 0; i < this.modifiers.length; i++) {
        s += this.modifiers[i].toXCQL(n + 2, c)
      }
      s = s + indent(n + 2, c) + '</modifiers>\n'
    }
    s = s + indent(n + 1, c) + '</relation>\n'
    s = s + indent(n + 1, c) + '<term>' + this.term + '</term>\n'
    s = s + indent(n, c) + '</searchClause>\n'
    return s
  }

  toFQ () {
    let s = '{"term": "' + this.term + '"'
    if (this.field.length > 0 && this.field !== this.scf) {
      s += ', "field": "' + this.field + '"'
    }
    if (this.relation.length > 0 && this.relation !== this.scr) {
      s += ', "relation": "' + this._mapRelation(this.relation) + '"'
    }
    for (let i = 0; i < this.modifiers.length; i++) {
          // since modifiers are mapped to keys, ignore the reserved ones
      if (this.modifiers[i].name === 'term' ||
            this.modifiers[i].name === 'field' ||
            this.modifiers[i].name === 'relation') {
        continue
      }
      s += ', ' + this.modifiers[i].toFQ()
    }
    s += '}'
    return s
  }

  _mapRelation (rel) {
    switch (rel) {
      case '<' : return 'lt'
      case '>' : return 'gt'
      case '=' : return 'eq'
      case '<>' : return 'ne'
      case '>=' : return 'ge'
      case '<=' : return 'le'
      default: return rel
    }
  }

  _remapRelation (rel) {
    switch (rel) {
      case 'lt' : return '<'
      case 'gt' : return '>'
      case 'eq' : return '='
      case 'ne' : return '<>'
      case 'ge' : return '>='
      case 'le' : return '<='
      default: return rel
    }
  }
}

class CQLBoolean {
  constructor () {
    this.op = null
    this.modifiers = null
    this.left = null
    this.right = null
  }

  toString () {
    return (this.left.op ? '(' + this.left + ')' : this.left) + ' ' +
        this.op +
        (this.modifiers.length > 0 ? '/' + this.modifiers.join('/') : '') +
        ' ' + (this.right.op ? '(' + this.right + ')' : this.right)
  }

  toXCQL (n, c) {
    let s = indent(n, c) + '<triple>\n'
    s = s + indent(n + 1, c) + '<boolean>\n' +
            indent(n + 2, c) + '<value>' + this.op + '</value>\n'
    if (this.modifiers.length > 0) {
      s = s + indent(n + 2, c) + '<modifiers>\n'
      for (let i = 0; i < this.modifiers.length; i++) {
        s += this.modifiers[i].toXCQL(n + 2, c)
      }
      s = s + indent(n + 2, c) + '</modifiers>\n'
    }
    s = s + indent(n + 1, c) + '</boolean>\n'
    s = s + indent(n + 1, c) + '<leftOperand>\n' +
            this.left.toXCQL(n + 2, c) + indent(n + 1, c) + '</leftOperand>\n'

    s = s + indent(n + 1, c) + '<rightOperand>\n' +
            this.right.toXCQL(n + 2, c) + indent(n + 1, c) + '</rightOperand>\n'
    s = s + indent(n, c) + '</triple>\n'
    return s
  }

  toFQ (n, c, nl) {
    let s = '{"op": "' + this.op + '"'
    // proximity modifiers
    for (let i = 0; i < this.modifiers.length; i++) {
      s += ', ' + this.modifiers[i].toFQ()
    }
    s += ',' + nl + indent(n, c) + ' "s1": ' + this.left.toFQ(n + 1, c, nl)
    s += ',' + nl + indent(n, c) + ' "s2": ' + this.right.toFQ(n + 1, c, nl)
    let fill = n && c ? ' ' : ''
    s += nl + indent(n - 1, c) + fill + '}'
    return s
  }
}

class CQLPrefixes {
  constructor () {
    // default list of prefixes from
    // http://www.loc.gov/standards/sru/cql/contextSets/listOfContextSets.html
    this.urisByPrefix = {
      'cql': 'info:srw/cql-context-set/1/cql-v1.2', // CQL context set Version 1.2
      'dc': 'info:srw/cql-context-set/1/dc-v1.1', // Dublin Core Context Set Version 1.1
      'bath': 'http://zing.z3950.org/cql/bath/2.0/', // Bath Context Set
      'rec': 'info:srw/cql-context-set/2/rec-1.1', // Record metadata
      'net': 'info:srw/cql-context-set/2/net-1.0', // Network resource information
      'music': 'info:srw/cql-context-set/3/music-1.0', // Music Context Set
      'zthes': 'http://zthes.z3950.org/cql/1.0/', // ZThes thesaurus context set v1.0
      'ccg': 'http://srw.cheshire3.org/contextSets/ccg/1.1/', // Collectable card games
      'zeerex': 'info:srw/cql-context-set/2/zeerex-1.1', // ZeeRex Context Set
      'marc': 'info:srw/cql-context-set/1/marc-1.1', // MARC Context Set
      'rel': 'info:srw/cql-context-set/2/relevance-1.0', // Relevance Ranking
      'sort': 'info:srw/cql-context-set/1/sort-v1.0', // Sort Context Set
      'gils': 'info:srw/cql-context-set/14/gils-v1.0', // GILS Context Set
      'norzig': 'info:srw/cql-context-set/15/norzig-1.0', // NorZIG Context Set
      'prism': 'info:srw/cql-context-set/11/prism-v2.1', // PRISM Context Set version 2.1
      'bib': 'info:srw/cql-context-set/1/bib-v1', // Bibliographic Context Set Version 1.0
      'jamas': 'info:srw/cql-context-set/16/jamas-v1.0' // Ichushiweb Context Set Version 1.0
    }
    // btoa encoded uris for reverse lookup of prefixes
    this.prefixesByBase64Uri = {
      'aW5mbzpzcncvY3FsLWNvbnRleHQtc2V0LzEvY3FsLXYxLjE=': 'cql', // CQL context set Version 1.1
      'aW5mbzpzcncvY3FsLWNvbnRleHQtc2V0LzEvY3FsLXYxLjI=': 'cql', // CQL context set Version 1.2
      'aW5mbzpzcncvY3FsLWNvbnRleHQtc2V0LzEvZGMtdjEuMQ==': 'dc', // Dublin Core Context Set Version 1.1
      'aHR0cDovL3ppbmcuejM5NTAub3JnL2NxbC9iYXRoLzIuMC8=': 'bath', // Bath Context Set
      'aW5mbzpzcncvY3FsLWNvbnRleHQtc2V0LzIvcmVjLTEuMQ==': 'rec', // Record metadata
      'aW5mbzpzcncvY3FsLWNvbnRleHQtc2V0LzIvbmV0LTEuMA==': 'net', // Network resource information
      'aW5mbzpzcncvY3FsLWNvbnRleHQtc2V0LzMvbXVzaWMtMS4w': 'music', // Music Context Set
      'aHR0cDovL3p0aGVzLnozOTUwLm9yZy9jcWwvMS4wLw==': 'zthes', // ZThes thesaurus context set v1.0
      'aHR0cDovL3Nydy5jaGVzaGlyZTMub3JnL2NvbnRleHRTZXRzL2NjZy8xLjEv': 'ccg', // Collectable card games
      'aW5mbzpzcncvY3FsLWNvbnRleHQtc2V0LzIvemVlcmV4LTEuMQ==': 'zeerex', // ZeeRex Context Set
      'aW5mbzpzcncvY3FsLWNvbnRleHQtc2V0LzEvbWFyYy0xLjE=': 'marc', // MARC Context Set
      'aW5mbzpzcncvY3FsLWNvbnRleHQtc2V0LzIvcmVsZXZhbmNlLTEuMA==': 'rel', // Relevance Ranking
      'aW5mbzpzcncvY3FsLWNvbnRleHQtc2V0LzEvc29ydC12MS4w': 'sort', // Sort Context Set
      'aW5mbzpzcncvY3FsLWNvbnRleHQtc2V0LzE0L2dpbHMtdjEuMA==': 'gils', // GILS Context Set
      'aW5mbzpzcncvY3FsLWNvbnRleHQtc2V0LzE1L25vcnppZy0xLjA=': 'norzig', // NorZIG Context Set
      'aW5mbzpzcncvY3FsLWNvbnRleHQtc2V0LzExL3ByaXNtLXYyLjA=': 'prism', // PRISM Context Set version 2.0
      'aW5mbzpzcncvY3FsLWNvbnRleHQtc2V0LzExL3ByaXNtLXYyLjE=': 'prism', // PRISM Context Set version 2.1
      'aW5mbzpzcncvY3FsLWNvbnRleHQtc2V0LzEvYmliLXYx': 'bib', // Bibliographic Context Set Version 1.0
      'aW5mbzpzcncvY3FsLWNvbnRleHQtc2V0LzE2L2phbWFzLXYxLjA=': 'jamas' // Ichushiweb Context Set Version 1.0
    }
  }

  prefixToUri (prefix) {
    if (this.urisByPrefix.hasOwnProperty(prefix)) {
      return this.urisByPrefix[prefix]
    }
    return ''
  }

  uriToPrefix (uri) {
    let encodedUri = btoa(uri)
    if (this.prefixesByBase64Uri.hasOwnProperty(encodedUri)) {
      return this.prefixesByBase64Uri[encodedUri]
    }
    return ''
  }

  addPrefix (prefix, uri) {
    let encodedUri = btoa(uri)
    this.urisByPrefix[prefix] = uri
    this.prefixesByBase64Uri[encodedUri] = prefix
  }
}

class CQLParser {
  constructor () {
    this.qi = null
    this.ql = null
    this.qs = null
    this.look = null
    this.lval = null
    this.val = null
    this.prefixes = new CQLPrefixes()
    this.tree = null
    this.scf = null
    this.scr = null
  }

  parse (query, scf, scr) {
    if (!query) {
      throw new Error('The query to be parsed cannot be empty')
    }
    this.scf = typeof scf !== 'string' ? DEFAULT_SERVER_CHOICE_FIELD : scf
    this.scr = typeof scr !== 'string' ? DEFAULT_SERVER_CHOICE_RELATION : scr
    this.qs = query
    this.ql = this.qs.length
    this.qi = 0
    this._move()
    this.tree = this._parseQuery(this.scf, this.scr, [])
    if (this.look !== '') {
      throw new Error('EOF expected')
    }
  }

  parseFromFQ (query, scf, scr) {
    if (!query) {
      throw new Error('The query to be parsed cannot be empty')
    }
    if (typeof query === 'string') {
      query = JSON.parse(query)
    }
    this.scf = typeof scf !== 'string' ? DEFAULT_SERVER_CHOICE_FIELD : scf
    this.scr = typeof scr !== 'string' ? DEFAULT_SERVER_CHOICE_RELATION : scr
    this.tree = this._parseFromFQ(query)
  }

  _parseFromFQ (fq) {
    // op-node
    if (fq.hasOwnProperty('op') &&
            fq.hasOwnProperty('s1') &&
            fq.hasOwnProperty('s2')) {
      let node = new CQLBoolean()
      node.op = fq.op
      node.left = this._parseFromFQ(fq.s1)
      node.right = this._parseFromFQ(fq.s2)
      // include all other members as modifiers
      node.modifiers = []
      for (let key in fq) {
        if (key === 'op' || key === 's1' || key === 's2') {
          continue
        }
        let mod = new CQLModifier()
        mod.name = key
        mod.relation = '='
        mod.value = fq[key]
        node.modifiers.push(mod)
      }
      return node
    }
    // search-clause node
    if (fq.hasOwnProperty('term')) {
      let node = new CQLSearchClause(
        fq.hasOwnProperty('field') ? fq.field : this.scf, '',
        fq.hasOwnProperty('relation') ? fq.relation : this.scr, '',
        [], fq.term, this.prefixes, this.scf, this.scr)
      node.relation = node._remapRelation(node.relation)

      for (let key in fq) {
        if (key === 'term' || key === 'field' || key === 'relation') {
          continue
        }
        let mod = new CQLModifier()
        mod.name = key
        mod.relation = '='
        mod.value = fq[key]
        node.modifiers.push(mod)
      }
      return node
    }
    throw new Error('Unknow node type; ' + JSON.stringify(fq))
  }

  toXCQL (c) {
    c = typeof c === 'undefined' ? ' ' : c
    return this.tree.toXCQL(0, c)
  }

  toFQ (c, nl) {
    c = typeof c === 'undefined' ? '  ' : c
    nl = typeof nl === 'undefined' ? '\n' : nl
    return this.tree.toFQ(0, c, nl)
  }

  toString () {
    return this.tree.toString()
  }

  _isBoolean (s) {
    return (s === 'and' || s === 'or' || s === 'not' || s === 'prox')
  }

  _parseQuery (field, relation, modifiers) {
    let left = this._parseSearchClause(field, relation, modifiers)
    while (this.look === 's' && this._isBoolean(this.lval)) {
      let b = new CQLBoolean()
      b.op = this.lval
      this._move()
      b.modifiers = this._parseModifiers()
      b.left = left
      b.right = this._parseSearchClause(field, relation, modifiers)
      left = b
    }
    return left
  }

  _parseModifiers () {
    let ar = []
    while (this.look === '/') {
      this._move()
      if (this.look !== 's' && this.look !== 'q') {
        throw new Error('Invalid modifier.')
      }

      let name = this.lval
      this._move()
      if (this.look.length > 0 &&
           this._strchr('<>=', this.look.charAt(0))) {
        let rel = this.look
        this._move()
        if (this.look !== 's' && this.look !== 'q') {
          throw new Error('Invalid relation within the modifier.')
        }

        let m = new CQLModifier()
        m.name = name
        m.relation = rel
        m.value = this.val.toLowerCase()
        ar.push(m)
        this._move()
      } else {
        let m = new CQLModifier()
        m.name = name
        m.relation = ''
        m.value = ''
        ar.push(m)
      }
    }
    return ar
  }

  _parseSearchClause (field, relation, modifiers) {
    if (this.look === '(') {
      this._move()
      let b = this._parseQuery(field, relation, modifiers)
      if (this.look === ')') {
        this._move()
      } else {
        throw new Error('Missing closing parenthesis.')
      }

      return b
    } else if (this.look === 's' || this.look === 'q') {
      let first = this.val.toLowerCase()   // dont know if field or term yet
      this._move()
      if (this.look === 'q' ||
                    (this.look === 's' && !this._isBoolean(this.lval))) {
        let rel = this.val.toLowerCase()    // string relation
        this._move()
        return this._parseSearchClause(first, rel,
                                               this._parseModifiers())
      } else if (this.look.length > 0 &&
          this._strchr('<>=', this.look.charAt(0))) {
        let rel = this.look.toLowerCase()   // other relation <, = ,etc
        this._move()
        return this._parseSearchClause(first, rel,
                                               this._parseModifiers())
      } else {
        // it's a search term
        let pos = field.indexOf('.')
        let pre = ''
        if (pos >= 0) {
          pre = field.substring(0, pos)
        }

        let uri = this._lookupPrefix(pre)
        if (uri.length > 0) {
          field = field.substring(pos + 1)
        }

        pos = relation.indexOf('.')
        if (pos === -1) {
          pre = DEFAULT_SERVER_PREFIX
        } else {
          pre = relation.substring(0, pos)
        }

        let reluri = this._lookupPrefix(pre)
        if (reluri.Length > 0) {
          relation = relation.Substring(pos + 1)
        }

        let sc = new CQLSearchClause(field,
                        uri,
                        relation,
                        reluri,
                        modifiers,
                        first,
                        this.prefixes,
                        this.scf,
                        this.scr)
        return sc
      }
    // prefixes
    } else if (this.look === '>') {
      this._move()
      if (this.look !== 's' && this.look !== 'q') {
        throw new Error('Expecting string or a quoted expression.')
      }

      let first = this.lval
      this._move()
      if (this.look === '=') {
        this._move()
        if (this.look !== 's' && this.look !== 'q') {
          throw new Error('Expecting string or a quoted expression.')
        }

        this._addPrefix(first, this.lval)
        this._move()
        return this._parseQuery(field, relation, modifiers)
      } else {
        this._addPrefix('default', first)
        return this._parseQuery(field, relation, modifiers)
      }
    } else {
      throw new Error('Invalid search clause.')
    }
  }

  _move () {
    // eat whitespace
    while (this.qi < this.ql &&
            this._strchr(' \t\r\n', this.qs.charAt(this.qi))) {
      this.qi++
    }
    // eof
    if (this.qi === this.ql) {
      this.look = ''
      return
    }
    // current char
    let c = this.qs.charAt(this.qi)
    // separators
    if (this._strchr('()/', c)) {
      this.look = c
      this.qi++
    // comparitor
    } else if (this._strchr('<>=', c)) {
      this.look = c
      this.qi++
      // comparitors can repeat, could be if
      while (this.qi < this.ql &&
              this._strchr('<>=', this.qs.charAt(this.qi))) {
        this.look = this.look + this.qs.charAt(this.qi)
        this.qi++
      }
    // quoted string
    } else if (this._strchr("\"'", c)) {
      this.look = 'q'
      // remember quote char
      let mark = c
      this.qi++
      this.val = ''
      let escaped = false
      while (this.qi < this.ql) {
        if (!escaped && this.qs.charAt(this.qi) === mark) {
          break
        }
        if (!escaped && this.qs.charAt(this.qi) === '\\') {
          escaped = true
        } else {
          escaped = false
        }
        this.val += this.qs.charAt(this.qi)
        this.qi++
      }
      this.lval = this.val.toLowerCase()
      if (this.qi < this.ql) {
        this.qi++
      } else { // unterminated
        this.look = ''
      } // notify error
    // unquoted string
    } else {
      this.look = 's'
      this.val = ''
      while (this.qi < this.ql &&
              !this._strchr('()/<>= \t\r\n', this.qs.charAt(this.qi))) {
        this.val = this.val + this.qs.charAt(this.qi)
        this.qi++
      }
      this.lval = this.val.toLowerCase()
    }
  }

  _strchr (s, ch) {
    return s.indexOf(ch) >= 0
  }

  _lookupPrefix (name) {
    return this.prefixes.prefixToUri(name)
  }

  _addPrefix (name, value) {
    // overwrite existing items
    this.prefixes.addPrefix(name, value)
  }
}

export default CQLParser
