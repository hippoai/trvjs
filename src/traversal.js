import { fromJS, Map } from 'immutable'

const KEY_SEPARATOR = '::'

const newPath = (starts) => {
  let o = {}
  for(let start of starts){
    o[start] = []
  }
  return fromJS(o)
}

const newResult = (graph, starts) => starts
  .filter((nodeKey) => graph.hasNode(nodeKey))
  .reduce(
    (acc, nodeKey) => graph.hasNode(nodeKey)
      ? acc.set(nodeKey, graph.getNode(nodeKey))
      : acc,
    Map()
  )

// renameKey
const renameKey = (key) => {
  const splitted = key.split(KEY_SEPARATOR)
  return splitted.length === 1
    ? {oldKey: splitted[0], newKey: splitted[0]}
    : {oldKey: splitted[0], newKey: splitted[1]}
}

const Step = (nodeKey, edgeKey) => {
  return {
    nodeKey, edgeKey
  }
}

const Trv = ({g, path = [], starts = []}) => {

  let _graph = g
  let _result = newResult(_graph, starts)
  let _cache = Map()
  let _path = (path.length > 0) ? path : newPath(starts)
  let _trvs = {}
  let _isDeep = false
  let _errors = []

  // isDeep
  const isDeep = () => _isDeep

  // size
  const size = () => _result.size

  // result
  const result = () => _result

  // cache
  const cache = () => _cache

  // graph
  const graph = () => _graph

  // errors
  const errors = () => _errors

  // isVeryDeep
  const isVeryDeep = () => {
    if(!_isDeep){
      return false
    }

    if(Object.keys(_trvs).length === 0){
      return false
    }

    for(let trvKey in _trvs){
      return _trvs[trvKey].isDeep()
    }

    return false
  }

  // _addError
  const _addError = (err) => {
    _errors.push(err)
  }

  // shallowSave
  function shallowSave(...keys) {
    if(_isDeep){
      for(let trvKey in _trvs){
        _trvs[trvKey] = _trvs[trvKey].shallowSave(...keys)
      }
      return this
    }

    _result.forEach((node, nodeKey) => {
      for(let key of keys){
        const {oldKey, newKey} = renameKey(key)
        const value = _graph.getNodeProp(nodeKey, oldKey)
        if(value !== undefined){
          _cache = _cache.setIn([nodeKey, newKey], value)
        }else{
          _addError(`Key ${oldKey} not found for node ${nodeKey}`)
        }
      }
    })
    return this
  }

  // deepSave
  function deepSave(name) {
    if(!_isDeep){
      return this
    }

    if(isVeryDeep()){
      for(let trvKey in _trvs){
        _trvs[trvKey] = _trvs[trvKey].deepSave(name)
      }
      return this
    }

    Object.keys(_trvs).forEach((nodeKey) => {
      const nestedTrv = _trvs[nodeKey]
      _cache = _cache.setIn([nodeKey, name], nestedTrv.cache())
    })

    return this
  }

  // deepen
  function deepen() {
    if(_isDeep){
      for(let trvKey in _trvs){
        _trvs[trvKey] = _trvs[trvKey].deepen()
      }
      return this
    }

    const trvs = {}
    _result.forEach((node) => {
      const nodeKey = node.get('key')
      trvs[nodeKey] = Trv({g: _graph, path: _path, starts: [nodeKey]})
    })

    _trvs = trvs
    _isDeep = true

    return this
  }

  // flatten
  function flatten() {
    if(!_isDeep){
      return this
    }

    if(isVeryDeep()){
      for(let trvKey in _trvs){
        _trvs[trvKey] = _trvs[trvKey].flatten()
      }
      return this
    }

    _errors = []
    Object.keys(_trvs).forEach((nodeKey) => {
      const nestedTrv = _trvs[nodeKey]
      nestedTrv.errors().forEach((err) => {
        _errors.push(err)
      })
    })

    _trvs = {}
    _isDeep = false

    return this
  }

  // shallowFilter
  function shallowFilter(predicate){

    if (_isDeep){
      for(let trvKey in _trvs){
        _trvs[trvKey] = _trvs[trvKey].shallowFilter(predicate)
      }
      return this
    }

    _result = _result.filter((node, nodeKey) => predicate(node, _path.get(nodeKey)))
    return this

  }

  // deepFilter
  function deepFilter(keepQuery){

    if(!_isDeep){
      return this
    }

    if(isVeryDeep()){
      for(let trvKey in _trvs){
        _trvs[trvKey] = _trvs[trvKey].deepFilter(keepQuery)
      }
      return this
    }

    let nodesToDiscard = []
    Object.keys(_trvs).forEach((nodeKey) => {
      const nestedTrv = _trvs[nodeKey]
      if(!keepQuery(nestedTrv, _path.get(nodeKey))){
        nodesToDiscard.push(nodeKey)
      }
    })

    nodesToDiscard.forEach((nodeKey) => {
      _result = _result.delete(nodeKey)
      delete _trvs[nodeKey]
    })
    return this
  }

  // hop
  function hop(getIncomingNodes, label, rememberPath){

    if(_isDeep){
      for(let trvKey in _trvs){
        _trvs[trvKey] = _trvs[trvKey].hop(getIncomingNodes, label, rememberPath)
      }
      return this
    }

    let newResult = Map()
    let newPath = Map()

    _result.forEach((aNode, aNodeKey) => {

      const edges = getIncomingNodes
        ? _graph.inEKeys(aNodeKey, label)
        : _graph.outEKeys(aNodeKey, label)

      edges.forEach((edgeLabel, edgeKey) => {
        const bNode = _graph.hop(edgeKey, aNodeKey)
        if(bNode === undefined){
          return
        }

        const bNodeKey = bNode.get('key')
        newResult = newResult.set(bNodeKey, bNode)
        newPath = newPath.set(
          bNodeKey,
          rememberPath
            ? _path.get(aNodeKey).concat([Step(aNodeKey, edgeKey)])
            : _path.get(aNodeKey)
        )
      })

    })

    _result = newResult
    _path = newPath

    return this
  }

  // inV
  function inV(label, rememberPath){
    hop(true, label, rememberPath)
    return this
  }

  // outV
  function outV(label, rememberPath){
    hop(false, label, rememberPath)
    return this
  }

  // public api
  return {
    isDeep, size, result, cache, graph, errors, isVeryDeep,
    shallowSave, deepSave, deepen, flatten,
    shallowFilter, deepFilter, hop, inV, outV
  }

}

export default Trv