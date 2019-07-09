class App {
  panner: CanvasPanner
  filesystem: FileSystem
  defaultSource: string
  editor: CodeMirrorEditor
  sourceChanged: () => void
  downloader: DownloadLinks
  signals: Observable = Observable({})
  on = this.signals.on
  off = this.signals.off

  constructor(
    nomnoml: Nomnoml,
    codeMirror: CodeMirror,
    saveAs: (blob: Blob, name: string) => void,
    throttle: Throttler,
    debounce: Throttler
  ) {
    var body = document.querySelector('body')
    var lineNumbers = document.getElementById('linenumbers')
    var lineMarker = document.getElementById('linemarker')
    var textarea = document.getElementById('textarea') as HTMLTextAreaElement
    var canvasElement = document.getElementById('canvas') as HTMLCanvasElement
    var canvasPanner = document.getElementById('canvas-panner')
    var canvasTools = document.getElementById('canvas-tools')

    this.editor = codeMirror.fromTextArea(textarea, {
      lineNumbers: true,
      mode: 'nomnoml',
      matchBrackets: true,
      theme: 'solarized light',
      keyMap: 'sublime'
    });

    var editorElement = this.editor.getWrapperElement()

    this.filesystem = new FileSystem()
    var devenv = new DevEnv(editorElement, lineMarker, lineNumbers)
    this.panner = new CanvasPanner(canvasPanner, () => this.sourceChanged(), throttle)
    this.downloader = new DownloadLinks(canvasElement, saveAs)
    new HoverMarker('canvas-mode', body, [canvasPanner, canvasTools])
    new Tooltips(document.getElementById('tooltip'), document.querySelectorAll('.tools a'))

    this.defaultSource = (document.getElementById('defaultGraph') || { innerHTML: '' }).innerHTML

    var reloadStorage = () => {
      this.filesystem.configureByRoute(location.hash)
      this.editor.setValue(this.filesystem.storage.read() || this.defaultSource)
      this.sourceChanged()
    }

    window.addEventListener('hashchange', () => reloadStorage());
    window.addEventListener('resize', throttle(() => this.sourceChanged(), 750, {leading: true}))
    this.editor.on('changes', debounce(() => this.sourceChanged(), 300))

    var renderedText: string = null;

    this.sourceChanged = () => {
      try {
        devenv.clearState()
        var source = this.editor.getValue()
        var model = nomnoml.draw(canvasElement, source, this.panner.zoom())
        renderedText = source
        this.panner.positionCanvas(canvasElement)
        this.filesystem.storage.save(source)
        this.downloader.setFilename(model.config.title)
        this.signals.trigger('source-changed', source)
      } catch (e){
        devenv.setError(e)
        // Rerender canvas with last successfully rendered text.
        nomnoml.draw(canvasElement, renderedText, this.panner.zoom())
        this.panner.positionCanvas(canvasElement)
      }
    }

    reloadStorage()
  }

  currentSource(): string {
    return this.editor.getValue()
  }

  magnifyViewport(diff: number){
    this.panner.magnify(diff)
  }

  resetViewport(){
    this.panner.reset()
  }

  toggleSidebar(id: string){
    var sidebars = ['about', 'reference', 'export']
    for(var key of sidebars){
      if (id !== key)
        document.getElementById(key).classList.remove('visible')
    }
    document.getElementById(id).classList.toggle('visible')
  }

  discardCurrentGraph(){
    if (confirm('Do you want to discard current diagram and load the default example?')){
      this.editor.setValue(this.defaultSource)
      this.sourceChanged()
    }
  }

  saveViewModeToStorage(){
    var question = 
      'Do you want to overwrite the diagram in ' +
      'localStorage with the currently viewed diagram?'
    if (confirm(question)){
      this.filesystem.moveToLocalStorage(this.currentSource())
      window.location.href = './'
    }
  }

  exitViewMode(){
    window.location.href = './'
  }
}
