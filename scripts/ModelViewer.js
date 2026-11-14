import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export {ModelViewer}

class ModelViewer {

	static allPasses = [
		"shaded",
		"unlit",
		"lighting",
		"roughness",
		"uv",
		"normals",
		"wireframe"
	]

	constructor(canvas) {

		// Setup ---------------------------------------
		this.timePrev = 0
		this.canvas = canvas
		this.showLoadError = this.showLoadError.bind(this)
		this.canvas.dataset.path = this.canvas.dataset.path || './3Dmodels/Test/piano.glb'
		this.setRenderer()
		this.loadModel(this.canvas.dataset.path).catch((error) => this.showLoadError(error)).then(()=>{

			this.calculateBounds()
			this.setDefaults(this.canvas.dataset)
			this.createUI()
			this.resizeRenderer()

			this.setOrbitCamera()
			this.setGround()
			this.setLighting()
			this.initShadingPasses()
			this.setShadingPass(this.defaults.pass)
			// show debug helpers
			// this.helpers.map((x) => this.scene.add(x))

			this.renderer.setAnimationLoop((t)=> this.animate(t))
		})

		// input events --------------------------------

		// handle responsive canvas resize
		window.addEventListener('resize', () => this.resizeRenderer())

		// Disable context menu when the right click started from the canvas
		let preventNextContextMenu = false
		this.renderer.domElement.addEventListener("mousedown", (e) => {
			if (e.button === 2) {// right click
				preventNextContextMenu = true
			}
		})
		window.addEventListener(`contextmenu`, (e) => {
			if(preventNextContextMenu) {
				e.preventDefault();
				preventNextContextMenu = false
			}
		})
	}

	// members for setup ---------------------------

	setRenderer() {
		this.renderer = new THREE.WebGLRenderer({
			canvas: this.canvas,
			antialias: true
		})

		this.scene = new THREE.Scene()

		this.helpers = []
		this.helpers.push(new THREE.AxesHelper(.1))
	}

	async loadModel(path) {
		const gltf = await new GLTFLoader().loadAsync(path)
		this.model = gltf.scene
		this.scene.add(this.model)
	}

	showLoadError(error) {
		console.error('ModelViewer: failed to load model', error)
		this.canvas.style.background = '#f8d7da'
		this.canvas.title = error?.message || 'Model failed to load'
	}

	calculateBounds() {
		this.boundsBox = new THREE.Box3().setFromObject(this.model)
		this.boundsSphere = this.boundsBox.getBoundingSphere(new THREE.Sphere())

		this.helpers.push(new THREE.Box3Helper(this.boundsBox, 0x0000ff))

		this.helpers.push(SphereHelper(this.boundsSphere.center, this.boundsSphere.radius, 'white'))
	}

	setDefaults(dataset) {

		this.defaults = {}
		this.defaults.aspect             = set('aspect', 1)
		this.defaults.passes             = set('passes', ModelViewer.allPasses)
		this.defaults.pass               = set('defaultPass', this.defaults.passes[0])
		this.defaults.cameraFov          = set('cameraFov', 25)
		this.defaults.cameraDistance     = set('cameraDistance', this.boundsSphere.radius* 100/this.defaults.cameraFov)
		this.defaults.cameraHeight       = set('cameraHeight', this.boundsBox.getCenter(new THREE.Vector3()).y)
		this.defaults.cameraPolarAngle   = set('cameraPolarAngle', 15)
		this.defaults.cameraAzimut       = set('cameraAzimut', -40)
		this.defaults.cameraEnableRotate = set('cameraEnableRotate', true)
		this.defaults.cameraEnableZoom   = set('cameraEnableZoom', true)
		this.defaults.cameraEnablePan    = set('cameraEnablePan', true)
		this.defaults.cameraAutoRotateSpeed = set('cameraAutoRotateSpeed', -1)
		this.defaults.groundColor        = set('groundColor', '#C0C0C0')
		this.defaults.backgroundColor    = set('backgroundColor', '#EEE')
		this.defaults.sunColor           = set('sunColor',           '#FFF')
		this.defaults.sunIntensity       = set('sunIntensity',       4)
		this.defaults.sunShadowStrength  = set('sunShadowStrength',  1)
		this.defaults.sunPolarAngle      = set('sunPolarAngle',      45)
		this.defaults.sunAzimut          = set('sunAzimut',          45)
		this.defaults.sunAutoRotateSpeed = set('sunAutoRotateSpeed', 0)
		this.defaults.ambientColor       = set('ambientColor',       '#FFF')
		this.defaults.ambientIntensity   = set('ambientIntensity',   1)

		function set(name, defaultValue) {
			if (dataset.hasOwnProperty(name)) {
				const value = dataset[name]
				switch(typeof defaultValue) {
					case "boolean":
						if (value === "true") return true
						if (value === "false") return false
					case "number":
						return Number(value)
					default:
						// works only for array of strings
						if (Array.isArray(defaultValue)) return value.split(",")
						return value
				}
			}
			else return defaultValue
		}
	}

	createUI() {
		// create HTML shading selector
		if (this.defaults.passes.length < 2)
			return

		const mvwrapper = document.createElement("div")
		mvwrapper.classList.add("mvwrapper")
		this.canvas.before(mvwrapper)
		mvwrapper.appendChild(this.canvas)

		const options = document.createElement("div")
		options.classList.add("options")
		mvwrapper.appendChild(options)

		const select = document.createElement("select")
		select.classList.add("shadingSelector")
		options.appendChild(select)

		this.defaults.passes.forEach(name => {
			const option = document.createElement("option")
			option.innerHTML = name
			select.appendChild(option)
		})
		// set state
		select.value = this.defaults.pass

		// connect shading option menu
		select.addEventListener('change', (event) => {
				event.preventDefault()
				this.setShadingPass(event.target.value)
		})
	}


	initShadingPasses() {
		this.geometries = []
		this.underWireframeMeshes = []
		this.materials = {}
		ModelViewer.allPasses.forEach(pass => this.materials[pass] = [])

		const uvmap = createCheckerTexture(64)
		uvmap.flipY = false
		uvmap.wrapS = THREE.RepeatWrapping
		uvmap.wrapT = THREE.RepeatWrapping
		uvmap.magFilter = THREE.NearestFilter

		const shaderUVs = {
			uniforms: {
				'map' : { value: uvmap },
			},
			vertexShader: `
				varying vec2 vUv;

				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,
			fragmentShader: `
				uniform sampler2D map;

				varying vec2 vUv;

				void main() {
					gl_FragColor = texture2D(map, vUv);
				}`
		}

		const shaderRoughness = {
			vertex: `
				varying vec2 vUv;

				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,
			fragment: `
				uniform sampler2D map;

				varying vec2 vUv;

				void main() {
					float roughness = texture2D(map, vUv).g;
					gl_FragColor = vec4( roughness, roughness, roughness, 1.0 );
				}`
		}

		let i = 0
		this.model.traverse((x) => {
			if (x.isMesh) {
				this.geometries[i] = x.geometry

				this.materials['shaded'][i] = new THREE.MeshStandardMaterial().copy(x.material)

				this.materials['unlit'][i] = new THREE.MeshBasicMaterial({map: x.material.map})

				this.materials['lighting'][i] = new THREE.MeshStandardMaterial().copy(x.material)
				this.materials['lighting'][i].color.set('hsl(0,0%,70%)')
				this.materials['lighting'][i].map = null

				this.materials['roughness'][i] = new THREE.ShaderMaterial({
					uniforms: {
						'map': { value: x.material.roughnessMap },
					},
					vertexShader: shaderRoughness.vertex,
					fragmentShader: shaderRoughness.fragment,
					})

				this.materials['uv'][i] = new THREE.ShaderMaterial(shaderUVs)

				this.materials['normals'][i] = new THREE.MeshNormalMaterial()

				this.materials['wireframe'][i] = new THREE.MeshBasicMaterial({wireframe: true, color: 0x000000})

				x.castShadow = true
				x.receiveShadow = true

				i++
			}
		})

		// WIREFRAME BASE
		this.geometries.forEach((geo) => {
			const material = new THREE.MeshBasicMaterial({
				color: 'hsl(0,0%,85%)',
				polygonOffset: true,
				polygonOffsetUnits: 2
			})
			const mesh = new THREE.Mesh(geo, material)
			mesh.castShadow = true
			mesh.receiveShadow = true
			this.underWireframeMeshes.push(mesh)
		})
		this.underWireframeMeshes.forEach((mesh)=>{
			this.scene.add(mesh)
			mesh.visible = false
		})
	}

	setShadingPass(pass) {
		this.currentPass = pass
		let i = 0
		this.model.traverse((x) => {
			if (x.isMesh) {
				x.material = this.materials[this.currentPass][i]
				i++
				x.material.needsUpdate = true

				x.receiveShadow = (this.currentPass != 'wireframe')
				x.castShadow = (this.currentPass != 'wireframe')
			}
		})
		// show basemesh with wireframe
		this.underWireframeMeshes.forEach((mesh)=>{
			mesh.visible = (this.currentPass == 'wireframe')
		})

		// toggle shadow for specific shadings
		const passesWithShadows = ["shaded", "lighting"]
		this.sun.castShadow = passesWithShadows.includes(this.currentPass)
	}

	setGround() {
		if (this.defaults.groundColor == 'transparent') return

		// size and position are based on model bounding sphere
		const size = this.boundsSphere.radius * 4
		const center = new THREE.Vector3(this.boundsSphere.center.x, 0, this.boundsSphere.center.z)

		this.ground = new THREE.Mesh(
			new THREE.PlaneGeometry(size, size),
			new THREE.MeshLambertMaterial({color: this.defaults.groundColor})
		)
		this.ground.rotation.x = - Math.PI / 2
		this.ground.position.copy(center)
		this.ground.receiveShadow = true
		this.ground.name = "Scene Ground"

		this.scene.add(this.ground)
	}

	setOrbitCamera() {
		const cameraPivot = new THREE.Vector3(0, this.defaults.cameraHeight, 0)
		// camera values infered based on distance
		const minDistance = this.defaults.cameraDistance / 4
		const maxDistance = this.defaults.cameraDistance * 2
		const nearPlane = this.defaults.cameraDistance / 100
		const farPlane = this.defaults.cameraDistance * 100

		// print computed camera values
		// console.log({fov: this.defaults.cameraFov, distance: this.defaults.cameraDistance, cameraPivot, minDistance, maxDistance, nearPlane, farPlane})


		this.camera = new THREE.PerspectiveCamera(this.defaults.cameraFov, this.defaults.aspect, nearPlane, farPlane)
		this.camera.position.setFromSphericalCoords(
			this.defaults.cameraDistance,
			THREE.MathUtils.degToRad(90 - this.defaults.cameraPolarAngle),
			THREE.MathUtils.degToRad(this.defaults.cameraAzimut)
		)
		this.camera.position.add(cameraPivot)

		this.controls = new OrbitControls(this.camera, this.renderer.domElement)
		this.controls.minDistance = minDistance
		this.controls.maxDistance = maxDistance
		this.controls.target.copy(cameraPivot)
		this.controls.cursor.copy(cameraPivot)
		this.controls.maxTargetRadius = this.boundsSphere.radius * 0.75
		this.controls.cursorStyle = 'grab'
		this.controls.enableZoom = this.defaults.cameraEnableZoom
		this.controls.enablePan = this.defaults.cameraEnablePan
		this.controls.enableRotate = this.defaults.cameraEnableRotate
		this.controls.rotateSpeed = 0.6
		this.controls.autoRotate = true
		this.controls.autoRotateSpeed = this.defaults.cameraAutoRotateSpeed
		this.controls.enableDamping = true
		this.controls.dampingFactor = 0.18
		this.controls.mouseButtons = {
			LEFT: THREE.MOUSE.ROTATE,
			RIGHT: THREE.MOUSE.PAN
			// PAN also with shift or ctrl + LEFT
		}
		this.controls.touches = {
			ONE: THREE.TOUCH.ROTATE,
			TWO: THREE.TOUCH.DOLLY_PAN
		}
	}

	setLighting() {
		this.scene.background = new THREE.Color(this.defaults.backgroundColor)

		this.ambient = new THREE.AmbientLight(
			this.defaults.ambientColor,
			this.defaults.ambientIntensity
		)
		this.scene.add(this.ambient)

		this.sun = new THREE.DirectionalLight(
			this.defaults.sunColor,
			this.defaults.sunIntensity
		)
		this.scene.add(this.sun)

		// NOTE: Shadowmap bounds derive from the sun position
		// so we need to set the Directional light specificallys

		// Sun at center of the scene bounding box
		const pivot = this.boundsSphere.center.clone()
		const radius  = this.boundsSphere.radius

		// Setting the sun Position and Rotation isn't obvious
		// because in three.js DirectionalLight can't use rotation,
		// they rotate by tracking a target that must be in the scene Ã¨Ã©

		this.sun.target = new THREE.Object3D()
		this.scene.add(this.sun.target)

		// so we position the target and the sun at the same pivot point
		this.sun.target.position.copy(pivot)
		this.sun.position.copy(pivot)
		// and we offset the sun for the initial rotation
		this.sun.position.add(new THREE.Vector3().setFromSphericalCoords(
			radius,
			THREE.MathUtils.degToRad(90 - this.defaults.sunPolarAngle),
			THREE.MathUtils.degToRad(this.defaults.sunAzimut)
		))

		this.renderer.shadowMap.enabled = true
		this.renderer.shadowMap.type = THREE.PCFShadowMap
		this.sun.castShadow = true
		this.sun.shadow.bias = 0
		this.sun.shadow.normalBias = radius / 340 // based on trial and error
		this.sun.shadow.intensity = this.defaults.sunShadowStrength
		this.sun.shadow.mapSize.width  = 1024
		this.sun.shadow.mapSize.height = 1024

		// Shadows parameters set so that the frustrum is as small as possible
		this.sun.shadow.camera.top    = +radius
		this.sun.shadow.camera.right  = +radius
		this.sun.shadow.camera.bottom = -radius
		this.sun.shadow.camera.left   = -radius
		this.sun.shadow.camera.near   = 0
		this.sun.shadow.camera.far    = radius * 10 // to encompass the ground

		this.controlsLight = new OrbitControls(this.sun, this.renderer.domElement)
		this.controlsLight.enableRotate = false
		this.controlsLight.enableZoom = false
		this.controlsLight.enablePan = false
		this.controlsLight.cursorStyle = 'grab'
		this.controlsLight.enableDamping = true
		this.controlsLight.dampingFactor = 0.08
		this.controlsLight.rotateSpeed = -1
		this.controlsLight.autoRotate = true
		this.controlsLight.autoRotateSpeed = this.defaults.sunAutoRotateSpeed
		this.controlsLight.minPolarAngle = THREE.MathUtils.degToRad(10)
		this.controlsLight.maxPolarAngle = THREE.MathUtils.degToRad(170)

		this.controlsLight.target.copy(pivot)
		// this.controlsLight.mouseButtons = {
		// 	RIGHT: THREE.MOUSE.ROTATE
		// }
		// this.controlsLight.touches = {
		// 	TWO: THREE.TOUCH.ROTATE
		// }

		// Debugs
		this.helpers.push(SphereHelper(this.sun.target.position, radius/10, 'red'))
		this.helpers.push(SphereHelper(this.controls.target, radius/10, 'green'))
		this.helpers.push(new THREE.CameraHelper(this.sun.shadow.camera))
	}

	// other members -------------------------------

	resizeRenderer() {
		const canvas = this.renderer.domElement
		const width  = canvas.clientWidth * window.devicePixelRatio
		const height = width / this.defaults.aspect

		if (canvas.width !== width)
			this.renderer.setSize(width, height, false)
	}

	animate(time) {
		// calculate delta, in seconds
		let delta = (time - this.timePrev) / 1000
		this.timePrev = time
		// console.log(`${1 / delta} FPS, ${delta * 1000}ms`)

		// don't pass delta if tab has been hidden
		// or if delta is huge
		// to prevent huge deltas (autorotation then spins a lot)
		if (document.hidden || delta > 0.5) {
			delta = undefined
		}

		this.controls.update(delta)
		this.controlsLight.update(delta)
		this.renderer.render(this.scene, this.camera)
	}
}

// helper functions

function SphereHelper(center, radius, color = 0xffffff) {
	const geometry = new THREE.SphereGeometry(radius, 8, 8)
	geometry.translate(center.x, center.y, center.z)
	const wireframe = new THREE.WireframeGeometry(geometry)
	const line = new THREE.LineSegments(wireframe)
	line.material.color.set(color)
	return line
}

function recursiveMapOnObject(obj, func) {
	for (let [key, value] of Object.entries(obj)) {
		if (typeof value === 'object' && value !== null) {
			recursiveMapOnObject(value, func)
		}
		else if (obj.hasOwnProperty(key)) {
			func(key, value)
		}
	}
}

function createCheckerTexture(size = 64) {
	const canvas = document.createElement('canvas')
	canvas.width = size
	canvas.height = size
	const ctx = canvas.getContext('2d')
	const dark = '#666666'
	const light = '#d9d9d9'
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			ctx.fillStyle = (x + y) % 2 === 0 ? light : dark
			ctx.fillRect(x, y, 1, 1)
		}
	}
	const texture = new THREE.CanvasTexture(canvas)
	texture.colorSpace = THREE.SRGBColorSpace
	texture.needsUpdate = true
	return texture
}

window.modelViewers = []
document.querySelectorAll(".modelViewer").forEach((x, i) => {
	window.modelViewers[i] = new ModelViewer(x)
})
/*
TODO
	X auto shadow settings
	X responsive aspect ratio
	X multiple aspect ratio
	X toggle debugs
	X passes
	X multiple viewers
	X auto-rotate
	X defaults
	X same ground and bg color (manual)
	X option for ground
	X pixel-ratio
	X setup in html
	X set specific passes
	- better controls: no zoom on scroll (PC, MOBILE)
	- click to set camera target
	- reset view (click in void?)
	- quad wireframe
	- anim

references
	https://discoverthreejs.com/book/appendix/asynchronous-javascript/
	https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Classes
*/